import type { MainOptions } from './main.js';
import { runCommand } from './spawn.js';
import type { GitHubComment, GitHubIssue, IssueInfo } from './types.js';
import { downloadImageAsDataURL, extractImageUrls } from './utils/image-utils.js';
import { stripHtmlComments } from './utils.js';

export async function createIssueInfo(options: MainOptions): Promise<IssueInfo> {
  const processedIssues = new Set<number>();
  const issueInfo = await fetchIssueData(options.issueNumber, processedIssues);
  if (!issueInfo) {
    throw new Error(`Failed to fetch issue data for issue #${options.issueNumber}`);
  }
  return issueInfo;
}

async function fetchIssueData(
  issueNumber: number,
  processedIssues: Set<number>,
  isReferenced = false
): Promise<IssueInfo | undefined> {
  if (processedIssues.has(issueNumber)) {
    return;
  }
  processedIssues.add(issueNumber);

  const { stdout: issueResult } = await runCommand(
    'gh',
    [
      'issue',
      'view',
      issueNumber.toString(),
      '--json',
      'author,title,body,bodyHTML,labels,comments{id,author,authorAssociation,body,bodyHTML,createdAt,includesCreatedEdit,isMinimized,minimizedReason,reactionGroups,url,viewerDidAuthor},url',
    ],
    { ignoreExitStatus: true }
  );
  if (!issueResult) {
    return;
  }
  const issue: GitHubIssue = JSON.parse(issueResult);

  // extract image URLs & data from issue body
  const issueImageUrls = extractImageUrls(issue.bodyHTML);
  const issueImageData = await Promise.all(issueImageUrls.map((url) => downloadImageAsDataURL(url)));

  // Extract issue/PR references from the issue body and comments
  const allText = [issue.body, ...issue.comments.map((c) => c.body)].join('\n');
  const referencedNumbers = extractIssueReferences(allText);

  const issueInfo: IssueInfo = {
    author: issue.author.login,
    title: issue.title,
    description: stripHtmlComments(issue.body),
    imageUrls: issueImageUrls,
    imageData: issueImageUrls.map((url, i) => ({ url, dataUrl: issueImageData[i] })),
    comments: issue.comments.map((c: GitHubComment) => ({
      author: c.author.login,
      body: c.body,
      imageUrls: extractImageUrls(c.bodyHTML),
    })),
  };

  if (issue.url?.includes('/pull/') && !isReferenced) {
    const { stdout: prDiff } = await runCommand('gh', ['pr', 'diff', issueNumber.toString()], {
      ignoreExitStatus: true,
      truncateStdout: true,
    });
    if (prDiff.trim()) {
      issueInfo.code_changes = processDiffContent(prDiff.trim());
    }
  }

  if (referencedNumbers.length > 0) {
    const referencedIssuesPromises = referencedNumbers.map((num) => fetchIssueData(num, processedIssues, true));
    const referencedIssues = (await Promise.all(referencedIssuesPromises)).filter(
      (issue): issue is IssueInfo => !!issue
    );
    if (referencedIssues.length > 0) {
      issueInfo.referenced_issues = referencedIssues;
    }
  }

  return issueInfo;
}

function extractIssueReferences(text: string): number[] {
  const regex = /(?:^|\s)#(\d+)/g;
  const numbers: number[] = [];
  for (;;) {
    const match = regex.exec(text);
    if (!match) break;

    numbers.push(Number.parseInt(match[1], 10));
  }
  return [...new Set(numbers)]; // Remove duplicates
}

/**
 * Process diff content to handle large diffs by truncating or omitting large fragments
 */
function processDiffContent(diffContent: string): string {
  const MAX_TOTAL_DIFF_SIZE = 50000;
  const MAX_FILE_DIFF_SIZE = 10000;
  const LARGE_FILE_PATTERNS = [
    /^diff --git a\/dist\//m,
    /^diff --git a\/build\//m,
    /^diff --git a\/.*\.bundle\./m,
    /^diff --git a\/.*\.min\./m,
    /^diff --git a\/node_modules\//m,
  ];

  // If the entire diff is small enough, return as-is
  if (diffContent.length <= MAX_TOTAL_DIFF_SIZE) {
    return diffContent;
  }

  // Split diff into individual file sections
  const fileSections = diffContent.split(/(?=^diff --git)/m);
  const processedSections: string[] = [];
  let totalSize = 0;

  for (const section of fileSections) {
    if (!section.trim()) continue;

    const isLargeFile = LARGE_FILE_PATTERNS.some((pattern) => pattern.test(section));

    if (isLargeFile) {
      // For large/bundled files, include only the header and a truncation notice
      const lines = section.split('\n');
      const headerLines = lines.slice(0, 4); // diff --git, index, ---, +++
      const truncatedSection = [
        ...headerLines,
        '@@ ... @@',
        '... (large bundled/compiled file diff truncated) ...',
        '',
      ].join('\n');

      processedSections.push(truncatedSection);
      totalSize += truncatedSection.length;
    } else if (section.length > MAX_FILE_DIFF_SIZE) {
      // For other large files, truncate but keep some content
      const truncatedSection = `${section.slice(0, MAX_FILE_DIFF_SIZE)}\n... (diff truncated) ...\n`;
      processedSections.push(truncatedSection);
      totalSize += truncatedSection.length;
    } else {
      // Small files, include as-is
      processedSections.push(section);
      totalSize += section.length;
    }

    // Stop if we're approaching the total size limit
    if (totalSize > MAX_TOTAL_DIFF_SIZE * 0.9) {
      processedSections.push('\n... (remaining diffs truncated) ...\n');
      break;
    }
  }

  return processedSections.join('');
}
