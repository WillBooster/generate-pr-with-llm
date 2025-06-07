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
});
