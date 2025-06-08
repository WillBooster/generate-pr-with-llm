import type { MainOptions } from './main.js';
import { runCommand } from './spawn.js';
import type { GitHubComment, GitHubIssue, GitHubTimelineItem, IssueInfo } from './types.js';
import { stripHtmlComments } from './utils.js';

interface GraphQLTimelineNode {
  __typename: string;
  source?: {
    __typename: 'Issue' | 'PullRequest';
    number: number;
  };
}

interface GraphQLTimelineResponse {
  data?: {
    repository?: {
      issue?: {
        timelineItems?: {
          nodes: GraphQLTimelineNode[];
        };
      };
    };
  };
}

interface IssueReference {
  number: number;
  type: 'issue' | 'pullRequest';
}

function extractIssueReferences(text: string): IssueReference[] {
  const references: IssueReference[] = [];

  for (;;) {
    // Match patterns like #123, #456, etc.
    const match = /#(\d+)/g.exec(text);
    if (!match) break;

    const number = Number.parseInt(match[1], 10);
    // For simplicity, we'll treat all references as issues
    // In a real implementation, you might want to check if it's actually a PR
    references.push({ number, type: 'issue' });
  }

  // Remove duplicates
  return references.filter(
    (ref, index, arr) => arr.findIndex((r) => r.number === ref.number && r.type === ref.type) === index
  );
}

async function fetchIssueData(
  issueNumber: number,
  processedIssues: Set<number>,
  isReferenced = false
): Promise<IssueInfo | null> {
  if (processedIssues.has(issueNumber)) {
    return null;
  }
  processedIssues.add(issueNumber);

  const issueResult = await runCommand(
    'gh',
    ['issue', 'view', issueNumber.toString(), '--json', 'author,title,body,labels,comments,url'],
    { ignoreExitStatus: true }
  );
  if (!issueResult) {
    return null;
  }
  const issue: GitHubIssue = JSON.parse(issueResult);

  // Extract issue/PR references from the issue body and comments
  const allText = [issue.body, ...issue.comments.map((c) => c.body)].join('\n');
  const issueReferences = extractIssueReferences(allText);

  if (issueReferences.length > 0) {
    issue.timelineItems = issueReferences.map((ref) => ({
      __typename: 'ReferenceEvent',
      source: ref.type === 'issue' ? { issue: { number: ref.number } } : { pullRequest: { number: ref.number } },
    }));
  }

  const cleanedIssueBody = stripHtmlComments(issue.body);
  const issueInfo: IssueInfo = {
    author: issue.author.login,
    title: issue.title,
    description: cleanedIssueBody,
    comments: issue.comments.map((c: GitHubComment) => ({
      author: c.author.login,
      body: c.body,
    })),
  };

  if (issue.url?.includes('/pull/') && !isReferenced) {
    const prDiff = await runCommand('gh', ['pr', 'diff', issueNumber.toString()], {
      ignoreExitStatus: true,
    });
    if (prDiff.trim()) {
      issueInfo.code_changes = prDiff.trim();
    }
  }

  if (issue.timelineItems) {
    const referencedIssuesPromises = issue.timelineItems
      .filter(
        (item): item is GitHubTimelineItem & { __typename: 'ReferenceEvent' } =>
          item.__typename === 'ReferenceEvent' && !!(item.source?.issue?.number || item.source?.pullRequest?.number)
      )
      .map((item) => {
        const referencedIssueNumber = item.source?.issue?.number || item.source?.pullRequest?.number;
        if (referencedIssueNumber) {
          return fetchIssueData(referencedIssueNumber, processedIssues, true);
        }
        return Promise.resolve(null);
      });

    const referencedIssues = (await Promise.all(referencedIssuesPromises)).filter(
      (issue): issue is IssueInfo => issue !== null
    );

    if (referencedIssues.length > 0) {
      issueInfo.referenced_issues = referencedIssues;
    }
  }

  return issueInfo;
}

export async function createIssueInfo(options: MainOptions): Promise<IssueInfo> {
  const processedIssues = new Set<number>();
  const issueInfo = await fetchIssueData(options.issueNumber, processedIssues);
  if (!issueInfo) {
    throw new Error(`Failed to fetch issue data for issue #${options.issueNumber}`);
  }
  return issueInfo;
}
