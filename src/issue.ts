import type { MainOptions } from './main.js';
import { runCommand } from './spawn.js';
import type { GitHubComment, GitHubIssue, IssueInfo } from './types.js';
import { stripHtmlComments } from './utils.js';

export async function createIssueInfo(options: MainOptions): Promise<IssueInfo> {
  const issueResult = await runCommand('gh', [
    'issue',
    'view',
    options.issueNumber.toString(),
    '--json',
    'author,title,body,labels,comments,url',
  ]);
  const issue: GitHubIssue = JSON.parse(issueResult);

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
    const prDiff = await runCommand('gh', ['pr', 'diff', options.issueNumber.toString()], {
      ignoreExitStatus: true,
    });
    if (prDiff.trim()) {
      issueInfo.code_changes = prDiff.trim();
    }
  }
  return issueInfo;
}
