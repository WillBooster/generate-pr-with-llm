import process from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  DEFAULT_AIDER_EXTRA_ARGS,
  DEFAULT_CLAUDE_CODE_EXTRA_ARGS,
  DEFAULT_CODING_TOOL,
  DEFAULT_MAX_TEST_ATTEMPTS,
  DEFAULT_REPOMIX_EXTRA_ARGS,
} from './defaultOptions.js';
import { main } from './main.js';
import type { CodingTool, ReasoningEffort } from './types.js';

// Parse command line arguments using yargs
const argv = await yargs(hideBin(process.argv))
  // Options same with the GitHub Actions workflow
  .option('issue-number', {
    alias: 'i',
    description: 'GitHub issue number to process',
    type: 'number',
    demandOption: true,
  })
  .option('planning-model', {
    alias: 'm',
    description:
      'LLM for planning code changes. Must use llmlite format: provider/model (e.g., openai/gpt-4.1, azure/gpt-4.1, gemini/gemini-2.5-pro-preview-06-05, anthropic/claude-4-sonnet-latest, bedrock/us.anthropic.claude-sonnet-4-20250514-v1:0, vertex/gemini-2.5-pro-preview-06-05)',
    type: 'string',
  })
  .option('two-staged-planning', {
    alias: 'p',
    description:
      'Enable two-staged planning: first select relevant files, then generate detailed implementation plans (increases LLM cost but improves code quality)',
    type: 'boolean',
    default: true,
  })
  .option('reasoning-effort', {
    alias: 'e',
    description: 'Constrains effort on reasoning for planning models. Supported values are low, medium, and high.',
    type: 'string',
    choices: ['low', 'medium', 'high'],
  })
  .option('coding-tool', {
    alias: 'c',
    description: 'Coding tool to use for making changes',
    type: 'string',
    choices: ['aider', 'claude-code'],
    default: DEFAULT_CODING_TOOL,
  })
  .option('aider-extra-args', {
    alias: 'a',
    description: 'Additional arguments to pass to the aider command (only used when coding-tool is aider)',
    type: 'string',
    default: DEFAULT_AIDER_EXTRA_ARGS,
  })
  .option('claude-code-extra-args', {
    description: 'Additional arguments to pass to the claude-code command (only used when coding-tool is claude-code)',
    type: 'string',
    default: DEFAULT_CLAUDE_CODE_EXTRA_ARGS,
  })
  .option('repomix-extra-args', {
    alias: 'r',
    description: 'Additional arguments for repomix when generating context',
    type: 'string',
    default: DEFAULT_REPOMIX_EXTRA_ARGS,
  })
  .option('test-command', {
    alias: 't',
    description: 'Command to run after the coding tool applies changes. If it fails, the assistant will try to fix it.',
    type: 'string',
  })
  .option('max-test-attempts', {
    description: 'Maximum number of attempts to fix test failures',
    type: 'number',
    default: DEFAULT_MAX_TEST_ATTEMPTS,
  })
  .option('dry-run', {
    alias: 'd',
    description: 'Run without making actual changes (no branch creation, no PR)',
    type: 'boolean',
    default: false,
  })
  // Options only for this standalone tool --------------------
  .option('working-dir', {
    alias: 'w',
    description: 'Working directory path for commands',
    type: 'string',
  })
  // ----------------------------------------------------------
  .help().argv;

if (argv['working-dir']) {
  process.chdir(argv['working-dir']);
  console.info(`Changed working directory to: ${process.cwd()}`);
}

await main({
  aiderExtraArgs: argv['aider-extra-args'],
  claudeCodeExtraArgs: argv['claude-code-extra-args'],
  codingTool: argv['coding-tool'] as CodingTool,
  dryRun: argv['dry-run'],
  twoStagePlanning: argv['two-staged-planning'],
  issueNumber: argv['issue-number'],
  maxTestAttempts: argv['max-test-attempts'],
  planningModel: argv['planning-model'],
  reasoningEffort: argv['reasoning-effort'] as ReasoningEffort,
  repomixExtraArgs: argv['repomix-extra-args'],
  testCommand: argv['test-command'],
});
