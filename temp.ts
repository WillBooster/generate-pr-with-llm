import child_process from 'node:child_process';

// npx --yes @anthropic-ai/claude-code@latest --allowedTools Bash Edit Write --dangerously-skip-permissions "Modify the code to resolve the GitHub issue."

child_process.spawn('npx', [
  '--yes',
  '@anthropic-ai/claude-code@latest',
  '--allowedTools',
  'Bash Edit Write',
  '--dangerously-skip-permissions',
  '--print',
  `Modify the code to resolve the following GitHub issue.

# Issue

\`\`\`yml
author: exKAZUu
title: 'feat: print "Hi" (<- example issue for debugging gen-pr)'
description: Modify src/main.ts to print "Hi" at first
comments: []
\`\`\``,
]);
