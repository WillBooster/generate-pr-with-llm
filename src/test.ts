import ansis from 'ansis';
import type { MainOptions } from './main.js';
import { findDistinctFence } from './markdown.js';
import type { ResolutionPlan } from './plan.js';
import { runCommand, spawnAsync } from './spawn.js';
import { buildAiderArgs } from './tools/aider.js';
import { buildClaudeCodeArgs } from './tools/claudeCode.js';
import { buildCodexArgs } from './tools/codex.js';
import { parseCommandLineArgs } from './utils.js';

export async function testAndFix(options: MainOptions, resolutionPlan?: ResolutionPlan): Promise<string> {
  const maxAttempts = options.maxTestAttempts;
  let attempts = 0;
  let fixResult = '';

  while (attempts < maxAttempts) {
    attempts++;
    console.info(ansis.cyan(`Executing test command (attempt ${attempts}/${maxAttempts}): ${options.testCommand}`));
    const [commandProgram, ...commandArgs] = parseCommandLineArgs(options.testCommand || '');

    const testResult = await spawnAsync(commandProgram, commandArgs, {
      cwd: process.cwd(),
    });

    if (testResult.status === 0) {
      console.info(ansis.green('Test command passed successfully.'));
      break;
    }

    console.warn(ansis.yellow(`Test command failed with exit code ${testResult.status}.`));

    // Only try to fix if we haven't reached the maximum attempts
    if (attempts >= maxAttempts) {
      console.warn(ansis.yellow(`Maximum fix attempts (${maxAttempts}) reached. Giving up.`));
      break;
    }

    const stdoutFence = findDistinctFence(testResult.stdout);
    const stderrFence = findDistinctFence(testResult.stderr);
    const prompt = `
The previous changes were applied, but the test command \`${options.testCommand}\` failed.

Exit code: ${testResult.status}

Stdout:
${stdoutFence}
${testResult.stdout}
${stdoutFence}

Stderr:
${stderrFence}
${testResult.stderr}
${stderrFence}

Please analyze the output and fix the errors.
`.trim();

    fixResult += await runAssistantFix(options, prompt, resolutionPlan);
  }

  return fixResult;
}

/**
 * Helper function to run coding tool with a fix prompt
 */
export async function runAssistantFix(
  options: MainOptions,
  prompt: string,
  resolutionPlan?: ResolutionPlan
): Promise<string> {
  const assistantName =
    options.codingTool === 'aider' ? 'Aider' : options.codingTool === 'claude-code' ? 'Claude Code' : 'Codex';
  let assistantResult: string;

  if (options.codingTool === 'aider') {
    const aiderArgs = buildAiderArgs(options, { prompt, resolutionPlan });
    console.info(ansis.cyan(`Asking Aider to fix "${options.testCommand}"...`));
    assistantResult = (
      await runCommand('aider', aiderArgs, {
        env: { ...process.env, NO_COLOR: '1' },
      })
    ).stdout;
  } else if (options.codingTool === 'claude-code') {
    const claudeCodeArgs = buildClaudeCodeArgs(options, { prompt, resolutionPlan });
    console.info(ansis.cyan(`Asking Claude Code to fix "${options.testCommand}"...`));
    assistantResult = (
      await runCommand('npx', claudeCodeArgs, {
        env: { ...process.env, NO_COLOR: '1' },
        stdio: 'inherit',
      })
    ).stdout;
  } else {
    const codexArgs = buildCodexArgs(options, { prompt, resolutionPlan });
    console.info(ansis.cyan(`Asking Codex to fix "${options.testCommand}"...`));
    assistantResult = (
      await runCommand('npx', codexArgs, {
        env: { ...process.env, NO_COLOR: '1' },
      })
    ).stdout;
  }

  return `\n\n# ${assistantName} fix attempt for "${options.testCommand}"\n\n${assistantResult.trim()}`;
}
