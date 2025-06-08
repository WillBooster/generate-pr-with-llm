import type { MainOptions } from './main.js';
import type { ResolutionPlan } from './plan.js';

/**
 * Builds the command line arguments for the claude-code command
 *
 * @param options The main options object
 * @param args Arguments to include
 * @returns An array of command line arguments for claude-code
 */
export function buildClaudeCodeArgs(
  options: MainOptions,
  args: { prompt: string; resolutionPlan?: ResolutionPlan }
): string[] {
  const claudeCodeArgs: string[] = [];

  // Add basic arguments
  if (options.dryRun) {
    claudeCodeArgs.push('--dry-run');
  }

  // Add the prompt as a message
  claudeCodeArgs.push(args.prompt);

  return claudeCodeArgs;
}
