import type { MainOptions } from './main.js';
import { runCommand } from './spawn.js';
import type { GitHubComment, GitHubIssue, IssueInfo } from './types.js';
import { stripHtmlComments } from './utils.js';

function extractIssueReferences(text: string): number[] {
  const matches = text.match(/#(\d+)/g);
  if (!matches) return [];

  const numbers = matches.map((match) => Number.parseInt(match.substring(1), 10));
  return [...new Set(numbers)]; // Remove duplicates
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
  const referencedNumbers = extractIssueReferences(allText);

  const issueInfo: IssueInfo = {
    author: issue.author.login,
    title: issue.title,
    description: stripHtmlComments(issue.body),
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

  if (referencedNumbers.length > 0) {
    const referencedIssuesPromises = referencedNumbers.map((num) => fetchIssueData(num, processedIssues, true));

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
