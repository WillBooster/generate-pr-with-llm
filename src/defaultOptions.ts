/** "--yes-always --no-check-update --no-show-release-notes" is always applied */
export const DEFAULT_AIDER_EXTRA_ARGS = '--model gemini/gemini-2.5 --edit-format diff-fenced --no-gitignore';
/** "--dangerously-skip-permissions --print" is always applied */
export const DEFAULT_CLAUDE_CODE_EXTRA_ARGS = '--allowedTools Bash Edit Write';
/** nothing is always applied */
export const DEFAULT_CODEX_EXTRA_ARGS = '--approval-mode full-auto --quiet';
/** "--yolo" is always applied */
export const DEFAULT_GEMINI_EXTRA_ARGS = '';
export const DEFAULT_REPOMIX_EXTRA_ARGS = '--compress --remove-empty-lines --include "src/**/*.{ts,tsx},**/*.md"';
export const DEFAULT_MAX_TEST_ATTEMPTS = 5;
export const DEFAULT_CODING_TOOL = 'aider';
