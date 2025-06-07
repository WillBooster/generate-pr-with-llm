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
});
