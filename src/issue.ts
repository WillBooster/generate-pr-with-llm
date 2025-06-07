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

async function fetchIssueData(issueNumber: number, processedIssues: Set<number>): Promise<IssueInfo | null> {
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

  const urlMatch = issue.url.match(/github\.com\/([^/]+)\/([^/]+)\//);
  if (urlMatch) {
    const [, owner, repo] = urlMatch;
    const query = `query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          timelineItems(first: 100, itemTypes: [CROSS_REFERENCE_EVENT]) {
            nodes {
              __typename
              ... on CrossReferenceEvent {
                source {
                  __typename
                  ... on Issue { number }
                  ... on PullRequest { number }
                }
              }
            }
          }
        }
      }
    }`.replace(/\s+/g, ' ');

    const timelineResult = await runCommand(
      'gh',
      [
        'api',
        'graphql',
        '-f',
        `owner=${owner}`,
        '-f',
        `repo=${repo}`,
        '-f',
        `issueNumber=${issueNumber}`,
        '-f',
        `query=${query}`,
      ],
      { ignoreExitStatus: true }
    );

    if (timelineResult) {
      try {
        const timelineData: GraphQLTimelineResponse = JSON.parse(timelineResult);
        if (timelineData.data?.repository?.issue?.timelineItems?.nodes) {
          issue.timelineItems = timelineData.data.repository.issue.timelineItems.nodes.map((node) => {
            if (node.source?.__typename === 'Issue') {
              return {
                __typename: node.__typename,
                source: { issue: { number: node.source.number } },
              };
            }
            if (node.source?.__typename === 'PullRequest') {
              return {
                __typename: node.__typename,
                source: { pullRequest: { number: node.source.number } },
              };
            }
            return { __typename: node.__typename };
          });
        }
      } catch (e) {
        // Do nothing if parsing fails
      }
    }
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

  if (issue.url?.includes('/pull/')) {
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
        (item): item is GitHubTimelineItem & { __typename: 'CrossReferenceEvent' } =>
          item.__typename === 'CrossReferenceEvent' &&
          !!(item.source?.issue?.number || item.source?.pullRequest?.number)
      )
      .map((item) => {
        const referencedIssueNumber = item.source?.issue?.number || item.source?.pullRequest?.number;
        if (referencedIssueNumber) {
          return fetchIssueData(referencedIssueNumber, processedIssues);
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
