/** "--yes-always --no-check-update --no-show-release-notes" is always applied */
export const DEFAULT_AIDER_EXTRA_ARGS =
  '--no-gitignore --no-show-model-warnings --model gemini/gemini-2.5-pro-preview-06-05 --edit-format diff-fenced';
/** "--print" is always applied */
export const DEFAULT_CLAUDE_CODE_EXTRA_ARGS = '--allowedTools Bash Edit Write';
/** nothing is always applied */
export const DEFAULT_CODEX_EXTRA_ARGS = '--approval-mode full-auto --quiet';
export const DEFAULT_REPOMIX_EXTRA_ARGS = '--compress --remove-empty-lines --include "src/**/*.{ts,tsx},**/*.md"';
export const DEFAULT_MAX_TEST_ATTEMPTS = 5;
export const DEFAULT_CODING_TOOL = 'aider';
