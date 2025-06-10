import type { MainOptions } from './main.js';
import type { ResolutionPlan } from './plan.js';
import { parseCommandLineArgs } from './utils.js';

/**
 * Builds the command line arguments for the npx codex command
 *
 * @param options The main options object
 * @param args Arguments to include
 * @returns An array of command line arguments for npx codex
 */
export function buildCodexArgs(
  options: MainOptions,
  args: { prompt: string; resolutionPlan?: ResolutionPlan }
): string[] {
  const codexArgs: string[] = [];

  codexArgs.push('--yes');
  codexArgs.push('codex');

  if (options.codexExtraArgs) {
    codexArgs.push(...parseCommandLineArgs(options.codexExtraArgs));
  }

  codexArgs.push(args.prompt);

  return codexArgs;
}
