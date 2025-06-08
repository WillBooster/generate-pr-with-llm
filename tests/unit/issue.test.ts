import { describe, expect, test } from 'bun:test';
import { createIssueInfo } from '../../src/issue.js';
import type { MainOptions } from '../../src/main.js';

describe('createIssueInfo', () => {
  // Test with real GitHub issue #32 data
  const realIssueOptions: MainOptions = {
    twoStagePlanning: false,
    dryRun: false,
    issueNumber: 32,
    maxTestAttempts: 3,
  };

  // Test with real GitHub PR #3 data
  const realPrOptions: MainOptions = {
    twoStagePlanning: false,
    dryRun: false,
    issueNumber: 3,
    maxTestAttempts: 3,
  };

  // Test with real GitHub issue #8 data (has referenced issues)
  const issueWithReferencesOptions: MainOptions = {
    twoStagePlanning: false,
    dryRun: false,
    issueNumber: 8,
    maxTestAttempts: 3,
  };

  // Test with real GitHub PR #9 data (has nested referenced issues: #9 → #8 → #32)
  const prWithNestedReferencesOptions: MainOptions = {
    twoStagePlanning: false,
    dryRun: false,
    issueNumber: 9,
    maxTestAttempts: 3,
  };

  test('should create IssueInfo from real GitHub issue #32', async () => {
    // Act - Call the real function with real GitHub issue #32
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Verify the expected structure and content based on real issue #32
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: Strip HTML comments from issue/PR descriptions before LLM processing');

    // The description should be the cleaned version (HTML comments stripped)
    expect(result.description).toContain('Current Behavior:');
    expect(result.description).toContain('Our tool currently extracts the raw Markdown content');
    expect(result.description).toContain('Problem:');
    expect(result.description).toContain('Proposed Solution:');
    expect(result.description).toContain('Modify the tool to parse and remove all HTML-style comments');

    // Issue #32 has no comments
    expect(result.comments).toEqual([]);

    // Issue #32 is not a PR, so no code_changes
    expect(result.code_changes).toBeUndefined();

    // Issue #32 has no outgoing references in its body or comments
    expect(result.referenced_issues).toBeUndefined();
  });

  test('should verify issue #32 has no comments', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Issue #32 should have no comments
    expect(result.comments).toEqual([]);
  });

  test('should verify issue #32 is not a pull request', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Issue #32 should not have code_changes since it's not a PR
    expect(result.code_changes).toBeUndefined();
  });

  test('should verify issue #32 author information', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Verify the author is correctly extracted
    expect(result.author).toBe('exKAZUu');
  });

  test('should verify issue #32 title is correctly extracted', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Verify the exact title
    expect(result.title).toBe('feat: Strip HTML comments from issue/PR descriptions before LLM processing');
  });

  test('should verify issue #32 description contains expected content', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Verify key parts of the description are present
    expect(result.description).toContain('Current Behavior:');
    expect(result.description).toContain('Problem:');
    expect(result.description).toContain('Proposed Solution:');
    expect(result.description).toContain('Increased Token Usage');
    expect(result.description).toContain('Potential LLM Confusion/Noise');
    expect(result.description).toContain('Accidental Information Leakage');
    expect(result.description).toContain('HTML-style comments');
  });

  test('should verify HTML comments are stripped from issue #32 description', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - The HTML comments should be stripped by stripHtmlComments function
    // Looking at the actual output, both HTML comment examples are stripped
    expect(result.description).toContain('(e.g., ``)'); // The HTML comment inside backticks is stripped
    expect(result.description).toContain('(``)'); // The HTML comment in the solution is also stripped
    expect(result.description).not.toContain('<!-- This is a comment -->'); // This should be stripped
    expect(result.description).not.toContain('<!-- ... -->'); // This should also be stripped
  });

  test('should return proper IssueInfo structure for issue #32', async () => {
    // Act
    const result = await createIssueInfo(realIssueOptions);

    // Assert - Verify the complete structure
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('comments');
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: Strip HTML comments from issue/PR descriptions before LLM processing');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.comments)).toBe(true);
    expect(result.comments).toHaveLength(0);
    // Issue #32 has no outgoing references
    expect(result.referenced_issues).toBeUndefined();
  });

  // Tests for PR #3 - Pull Request functionality
  test('should create IssueInfo from real GitHub PR #3', async () => {
    // Act - Call the real function with real GitHub PR #3
    const result = await createIssueInfo(realPrOptions);

    // Assert - Verify the expected structure and content based on real PR #3
    expect(result.author).toBe('app/renovate');
    expect(result.title).toBe('chore(deps): pin dependency python to 3.13.3');

    // The description should contain the PR body content
    expect(result.description).toContain('This PR contains the following updates:');
    expect(result.description).toContain('python');
    expect(result.description).toContain('3.x');
    expect(result.description).toContain('3.13.3');
    expect(result.description).toContain('Configuration');
    expect(result.description).toContain('Mend Renovate');

    // PR #3 has no comments
    expect(result.comments).toEqual([]);

    // PR #3 should have code_changes since it's a PR
    expect(result.code_changes).toBeDefined();
    expect(typeof result.code_changes).toBe('string');
  });

  test('should detect PR #3 as a pull request and fetch diff', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - PR #3 should have code_changes with the actual diff
    expect(result.code_changes).toBeDefined();
    expect(result.code_changes).toContain('diff --git a/action.yml b/action.yml');
    expect(result.code_changes).toContain('python-version:');
    expect(result.code_changes).toContain('3.x');
    expect(result.code_changes).toContain('3.13.3');
    expect(result.code_changes).toContain('actions/setup-python');
  });

  test('should verify PR #3 author is a bot', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - Verify the author is the renovate bot
    expect(result.author).toBe('app/renovate');
  });

  test('should verify PR #3 title contains dependency information', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - Verify the title contains expected dependency update info
    expect(result.title).toBe('chore(deps): pin dependency python to 3.13.3');
    expect(result.title).toContain('chore(deps)');
    expect(result.title).toContain('python');
    expect(result.title).toContain('3.13.3');
  });

  test('should verify PR #3 description contains renovate information', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - Verify key parts of the renovate PR description
    expect(result.description).toContain('This PR contains the following updates:');
    expect(result.description).toContain('Package');
    expect(result.description).toContain('Type');
    expect(result.description).toContain('Update');
    expect(result.description).toContain('Change');
    expect(result.description).toContain('uses-with');
    expect(result.description).toContain('pin');
    expect(result.description).toContain('Schedule');
    expect(result.description).toContain('Automerge');
    expect(result.description).toContain('Rebasing');
  });

  test('should verify PR #3 has no comments', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - PR #3 should have no comments
    expect(result.comments).toEqual([]);
  });

  test('should verify HTML comments are stripped from PR #3 description', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - The renovate debug comment should be stripped
    expect(result.description).not.toContain('<!--renovate-debug:');
    expect(result.description).not.toContain('<!-- rebase-check -->');
    // But the checkbox content should remain
    expect(result.description).toContain('If you want to rebase/retry this PR, check this box');
  });

  test('should return proper IssueInfo structure for PR #3', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - Verify the complete structure for a PR
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('comments');
    expect(result).toHaveProperty('code_changes');
    expect(result.author).toBe('app/renovate');
    expect(result.title).toBe('chore(deps): pin dependency python to 3.13.3');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.comments)).toBe(true);
    expect(result.comments).toHaveLength(0);
    expect(typeof result.code_changes).toBe('string');
    expect(result.code_changes?.length).toBeGreaterThan(0);
    // PR #3 has no referenced issues
    expect(result.referenced_issues).toBeUndefined();
  });

  test('should verify PR #3 diff contains expected file changes', async () => {
    // Act
    const result = await createIssueInfo(realPrOptions);

    // Assert - Verify the diff contains the expected changes
    expect(result.code_changes).toContain('action.yml');
    expect(result.code_changes).toContain('Set up Python');
    expect(result.code_changes).toContain('actions/setup-python@v4');
    expect(result.code_changes).toContain("-        python-version: '3.x'");
    expect(result.code_changes).toContain("+        python-version: '3.13.3'");
  });

  // Tests for issue #8 - Referenced issues functionality
  test('should create IssueInfo from real GitHub issue #8 with referenced issues', async () => {
    // Act - Call the real function with real GitHub issue #8
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - Verify the expected structure and content based on real issue #8
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: print "Hello World" on `src/index.ts` (<- example issue)');

    // The description should contain the issue content
    expect(result.description).toContain('Modify `src/index.ts` to print "Hello World"');

    // Issue #8 has comments including one that references #32
    expect(result.comments.length).toBeGreaterThan(0);
    expect(result.comments.some((c) => c.body.includes('#32'))).toBe(true);

    // Issue #8 is not a PR, so no code_changes
    expect(result.code_changes).toBeUndefined();

    // Issue #8 should have referenced issues (references issue #32)
    expect(result.referenced_issues).toBeDefined();
    expect(Array.isArray(result.referenced_issues)).toBe(true);
    expect(result.referenced_issues?.length).toBeGreaterThan(0);
  });

  test('should verify issue #8 has referenced issues with correct structure', async () => {
    // Act
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - Issue #8 should have referenced issues
    expect(result.referenced_issues).toBeDefined();
    expect(result.referenced_issues?.length).toBe(1);

    const referencedIssue = result.referenced_issues?.[0];
    expect(referencedIssue).toHaveProperty('author');
    expect(referencedIssue).toHaveProperty('title');
    expect(referencedIssue).toHaveProperty('description');
    expect(referencedIssue).toHaveProperty('comments');

    // The referenced issue should be issue #32
    expect(referencedIssue.author).toBe('exKAZUu');
    expect(referencedIssue.title).toBe('feat: Strip HTML comments from issue/PR descriptions before LLM processing');
    expect(referencedIssue.description).toContain('Current Behavior:');
  });

  test('should verify issue #8 referenced issue does not include code changes', async () => {
    // Act
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - The referenced issue should not have code_changes (to avoid including diffs)
    expect(result.referenced_issues).toBeDefined();
    const referencedIssue = result.referenced_issues?.[0];
    expect(referencedIssue.code_changes).toBeUndefined();
  });

  test('should verify issue #8 author and title information', async () => {
    // Act
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - Verify the author and title are correctly extracted
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: print "Hello World" on `src/index.ts` (<- example issue)');
  });

  test('should verify issue #8 has comments', async () => {
    // Act
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - Issue #8 should have comments
    expect(result.comments.length).toBeGreaterThan(0);
  });

  test('should verify issue #8 is not a pull request', async () => {
    // Act
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - Issue #8 should not have code_changes since it's not a PR
    expect(result.code_changes).toBeUndefined();
  });

  test('should return proper IssueInfo structure for issue #8 with referenced issues', async () => {
    // Act
    const result = await createIssueInfo(issueWithReferencesOptions);

    // Assert - Verify the complete structure including referenced_issues
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('comments');
    expect(result).toHaveProperty('referenced_issues');
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: print "Hello World" on `src/index.ts` (<- example issue)');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.comments)).toBe(true);
    expect(result.comments.length).toBeGreaterThan(0);
    expect(Array.isArray(result.referenced_issues)).toBe(true);
    expect(result.referenced_issues?.length).toBeGreaterThan(0);
  });

  // Tests for PR #9 - Nested referenced issues functionality (#9 → #8 → #32)
  test('should create IssueInfo from real GitHub PR #9 with nested referenced issues', async () => {
    // Act - Call the real function with real GitHub PR #9
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - Verify the expected structure and content based on real PR #9
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: add hello world step');

    // The description should contain the PR content
    expect(result.description).toContain('Closes #8');
    expect(result.description).toContain('Hello, World!');

    // PR #9 has no comments
    expect(result.comments).toEqual([]);

    // PR #9 is a PR, so it should have code_changes (since it's the main issue, not referenced)
    expect(result.code_changes).toBeDefined();
    expect(typeof result.code_changes).toBe('string');

    // PR #9 should have referenced issues (references issue #8)
    expect(result.referenced_issues).toBeDefined();
    expect(Array.isArray(result.referenced_issues)).toBe(true);
    expect(result.referenced_issues?.length).toBe(1);
  });

  test('should verify PR #9 has nested referenced issues structure', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - PR #9 should reference issue #8, which in turn references issue #32
    expect(result.referenced_issues).toBeDefined();
    expect(result.referenced_issues?.length).toBe(1);

    const referencedIssue8 = result.referenced_issues?.[0];
    expect(referencedIssue8).toHaveProperty('author');
    expect(referencedIssue8).toHaveProperty('title');
    expect(referencedIssue8).toHaveProperty('description');
    expect(referencedIssue8).toHaveProperty('comments');
    expect(referencedIssue8).toHaveProperty('referenced_issues');

    // The referenced issue should be issue #8
    expect(referencedIssue8.author).toBe('exKAZUu');
    expect(referencedIssue8.title).toBe('feat: print "Hello World" on `src/index.ts` (<- example issue)');
    expect(referencedIssue8.description).toContain('Modify `src/index.ts` to print "Hello World"');

    // Issue #8 should have its own referenced issues (issue #32)
    expect(referencedIssue8.referenced_issues).toBeDefined();
    expect(referencedIssue8.referenced_issues?.length).toBe(1);

    const referencedIssue32 = referencedIssue8.referenced_issues?.[0];
    expect(referencedIssue32.author).toBe('exKAZUu');
    expect(referencedIssue32.title).toBe('feat: Strip HTML comments from issue/PR descriptions before LLM processing');
    expect(referencedIssue32.description).toContain('Current Behavior:');
  });

  test('should verify PR #9 referenced issues do not include code changes', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - The referenced issues should not have code_changes (to avoid including diffs)
    expect(result.referenced_issues).toBeDefined();
    const referencedIssue8 = result.referenced_issues?.[0];
    expect(referencedIssue8.code_changes).toBeUndefined();

    // The nested referenced issue should also not have code_changes
    expect(referencedIssue8.referenced_issues).toBeDefined();
    const referencedIssue32 = referencedIssue8.referenced_issues?.[0];
    expect(referencedIssue32.code_changes).toBeUndefined();
  });

  test('should verify PR #9 author and title information', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - Verify the author and title are correctly extracted
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: add hello world step');
  });

  test('should verify PR #9 has no comments', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - PR #9 should have no comments
    expect(result.comments).toEqual([]);
  });

  test('should verify PR #9 is a pull request with code changes', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - PR #9 should have code_changes since it's the main PR (not referenced)
    expect(result.code_changes).toBeDefined();
    expect(typeof result.code_changes).toBe('string');
    expect(result.code_changes?.length).toBeGreaterThan(0);
  });

  test('should verify PR #9 diff contains expected file changes', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - Verify the diff contains the expected changes
    expect(result.code_changes).toContain('action.yml');
    expect(result.code_changes).toContain('Print Hello World');
    expect(result.code_changes).toContain('echo "Hello, World!"');
  });

  test('should return proper IssueInfo structure for PR #9 with nested referenced issues', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - Verify the complete structure including nested referenced_issues
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('comments');
    expect(result).toHaveProperty('code_changes');
    expect(result).toHaveProperty('referenced_issues');
    expect(result.author).toBe('exKAZUu');
    expect(result.title).toBe('feat: add hello world step');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.comments)).toBe(true);
    expect(result.comments).toHaveLength(0);
    expect(typeof result.code_changes).toBe('string');
    expect(result.code_changes?.length).toBeGreaterThan(0);
    expect(Array.isArray(result.referenced_issues)).toBe(true);
    expect(result.referenced_issues?.length).toBe(1);

    // Verify nested structure
    const referencedIssue8 = result.referenced_issues?.[0];
    expect(Array.isArray(referencedIssue8.referenced_issues)).toBe(true);
    expect(referencedIssue8.referenced_issues?.length).toBe(1);
  });

  test('should verify the complete reference chain #9 → #8 → #32', async () => {
    // Act
    const result = await createIssueInfo(prWithNestedReferencesOptions);

    // Assert - Verify the complete reference chain
    // PR #9 references issue #8
    expect(result.referenced_issues).toBeDefined();
    expect(result.referenced_issues?.length).toBe(1);
    expect(result.referenced_issues?.[0].title).toBe('feat: print "Hello World" on `src/index.ts` (<- example issue)');

    // Issue #8 references issue #32
    const issue8 = result.referenced_issues?.[0];
    expect(issue8.referenced_issues).toBeDefined();
    expect(issue8.referenced_issues?.length).toBe(1);
    expect(issue8.referenced_issues?.[0].title).toBe(
      'feat: Strip HTML comments from issue/PR descriptions before LLM processing'
    );

    // Issue #32 has no further references
    const issue32 = issue8.referenced_issues?.[0];
    expect(issue32.referenced_issues).toBeUndefined();
  });
});
