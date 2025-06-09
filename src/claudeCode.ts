import type { MainOptions } from './main.js';
import type { ResolutionPlan } from './plan.js';

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
  const claudeCodeArgs: string[] = [];

  // Add npx arguments
  claudeCodeArgs.push('--yes');
  claudeCodeArgs.push('@anthropic-ai/claude-code@latest');

  claudeCodeArgs.push(args.prompt);

  // Print response without interactive mode
  claudeCodeArgs.push('--print');
  // Skip permission prompts
  claudeCodeArgs.push('--dangerously-skip-permissions');

  // Allow all the tools
  claudeCodeArgs.push('--allowedTools');
  claudeCodeArgs.push('Bash');
  claudeCodeArgs.push('Edit');
  claudeCodeArgs.push('Write');

  // Add extra arguments if provided
  if (options.claudeCodeExtraArgs) {
    const extraArgs = options.claudeCodeExtraArgs.trim().split(/\s+/);
    claudeCodeArgs.push(...extraArgs);
  }

  return claudeCodeArgs;
}
