import { DEFAULT_CLAUDE_CODE_EXTRA_ARGS } from '../defaultOptions.js';
import type { MainOptions } from '../main.js';
import type { ResolutionPlan } from '../plan.js';
import { parseCommandLineArgs } from '../utils.js';

/**
 * Builds the command line arguments for the npx claude-code command
 *
 * @param options The main options object
 * @param args Arguments to include
 * @returns An array of command line arguments for npx @anthropic-ai/claude-code@latest
 */
export function buildClaudeCodeArgs(
  options: MainOptions,
  args: { prompt: string; resolutionPlan?: ResolutionPlan }
): string[] {
  // cf. https://docs.anthropic.com/en/docs/claude-code/cli-usage
  return [
    '--yes',
    '@anthropic-ai/claude-code@latest',
    ...parseCommandLineArgs(options.claudeCodeExtraArgs || DEFAULT_CLAUDE_CODE_EXTRA_ARGS),
    // Bypass all permission checks
    '--dangerously-skip-permissions',
    // Print response without interactive mode
    // '--print',
    args.prompt,
  ];
}
