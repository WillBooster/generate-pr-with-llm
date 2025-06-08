import child_process from 'node:child_process';
import ansis from 'ansis';
import YAML from 'yaml';
import { buildAiderArgs } from './aider.js';
import { buildClaudeCodeArgs } from './claudeCode.js';
import { configureEnvVars } from './env.js';
import { createIssueInfo } from './issue.js';
import { planCodeChanges } from './plan.js';
import { configureGitUserDetailsIfNeeded } from './profile.js';
import { runCommand } from './spawn.js';
import { testAndFix } from './test.js';
import type { CodeAssistant, ReasoningEffort } from './types.js';

/**
 * Options for the main function
 */
export interface MainOptions {
  /** Additional arguments to pass to the aider command */
  aiderExtraArgs?: string;
  /** Code assistant tool to use */
  codeAssistant: CodeAssistant;
  /** Enable two-staged planning: first select relevant files, then generate detailed implementation plans */
  twoStagePlanning: boolean;
  /** Run without making actual changes (no branch creation, no PR) */
  dryRun: boolean;
  /** GitHub issue number to process */
  issueNumber: number;
  /** Maximum number of attempts to fix test failures */
  maxTestAttempts: number;
  /** LLM model to use for planning code changes */
  planningModel?: string;
  /** Level of reasoning effort for the LLM */
  reasoningEffort?: ReasoningEffort;
  /** Extra arguments for repomix when generating context */
  repomixExtraArgs?: string;
  /** Command to run after code assistant applies changes. If it fails, the assistant will try to fix it. */
  testCommand?: string;
}

const MAX_ANSWER_LENGTH = 65000;

export async function main(options: MainOptions): Promise<void> {
  configureEnvVars();

  if (options.dryRun) {
    console.info(ansis.yellow('Running in dry-run mode. No branches or PRs will be created.'));
  } else {
    await configureGitUserDetailsIfNeeded();
  }

  // Install code assistant tools
  if (options.codeAssistant === 'aider') {
    await runCommand('python', ['-m', 'pip', 'install', 'aider-install']);
    await reshimToDetectNewTools();
    await runCommand('uv', ['tool', 'uninstall', 'aider-chat'], { ignoreExitStatus: true });
    await runCommand('aider-install', []);
    await reshimToDetectNewTools();

    if (options.aiderExtraArgs?.includes('bedrock/')) {
      await runCommand('uv', [
        'tool',
        'run',
        '--from',
        'aider-chat',
        'pip',
        'install',
        '--upgrade',
        '--upgrade-strategy',
        'only-if-needed',
        'boto3',
      ]);
      // await runCommand('aider', ['--install-main-branch', '--yes-always']);
    }
  }
  // Claude Code is assumed to be already installed via npm/brew/etc.

  const issueInfo = await createIssueInfo(options);
  const issueText = YAML.stringify(issueInfo).trim();

  const resolutionPlan =
    (options.planningModel &&
      (await planCodeChanges(
        options.planningModel,
        issueText,
        options.twoStagePlanning,
        options.reasoningEffort,
        options.repomixExtraArgs
      ))) ||
    undefined;
  const planText =
    resolutionPlan && 'plan' in resolutionPlan && resolutionPlan.plan
      ? `
# Plan

${resolutionPlan.plan}
`.trim()
      : '';
  const prompt = `
Modify the code to resolve the following GitHub issue:
\`\`\`\`yml
${issueText}
\`\`\`\`

${planText}
`.trim();
  console.log('Resolution plan:', resolutionPlan);

  const now = new Date();

  const branchName = `ai-pr-${options.issueNumber}-${now.getFullYear()}_${getTwoDigits(now.getMonth() + 1)}${getTwoDigits(now.getDate())}_${getTwoDigits(now.getHours())}${getTwoDigits(now.getMinutes())}${getTwoDigits(now.getSeconds())}`;
  if (!options.dryRun) {
    await runCommand('git', ['switch', '-C', branchName]);
  } else {
    console.info(ansis.yellow(`Would create branch: ${branchName}`));
  }

  // Execute code assistant
  let assistantResult: string;
  if (options.codeAssistant === 'aider') {
    const aiderArgs = buildAiderArgs(options, { prompt: prompt, resolutionPlan });
    assistantResult = await runCommand('aider', aiderArgs, {
      env: { ...process.env, NO_COLOR: '1' },
    });
  } else {
    const claudeCodeArgs = buildClaudeCodeArgs(options, { prompt: prompt, resolutionPlan });
    assistantResult = await runCommand('claude-code', claudeCodeArgs, {
      env: { ...process.env, NO_COLOR: '1' },
    });
  }

  let assistantAnswer = assistantResult.trim();
  if (options.testCommand) {
    assistantAnswer += await testAndFix(options, resolutionPlan);
  }

  // Try commiting changes because code assistant may fail to commit changes due to pre-commit hooks
  await runCommand('git', ['commit', '-m', `fix: Close #${options.issueNumber}`, '--no-verify'], {
    ignoreExitStatus: true,
  });
  if (!options.dryRun) {
    await runCommand('git', ['push', 'origin', branchName, '--no-verify']);
  } else {
    console.info(ansis.yellow(`Would push branch: ${branchName} to origin`));
  }

  // Create a PR using GitHub CLI
  const prTitle = getHeaderOfFirstCommit();
  let prBody = `Close #${options.issueNumber}

${planText}
`;
  const assistantName = options.codeAssistant === 'aider' ? 'Aider' : 'Claude Code';
  prBody += `
# ${assistantName} Log

\`\`\`\`
${assistantAnswer.slice(0, MAX_ANSWER_LENGTH - prBody.length)}
\`\`\`\``;
  prBody = prBody.replaceAll(/(?:\s*\n){2,}/g, '\n\n').trim();
  if (!options.dryRun) {
    const repoName = getGitRepoName();
    await runCommand('gh', ['pr', 'create', '--title', prTitle, '--body', prBody, '--repo', repoName]);
  } else {
    console.info(ansis.yellow(`Would create PR with title: ${prTitle}`));
    console.info(
      ansis.yellow(
        `PR body would include the ${assistantName.toLowerCase()} response and close issue #${options.issueNumber}`
      )
    );
  }

  console.info(`\nIssue #${options.issueNumber} processed successfully.`);
}

async function reshimToDetectNewTools() {
  try {
    // Make uv available on asdf environment
    await runCommand('asdf', ['reshim'], { ignoreExitStatus: true });
  } catch {
    // do nothing
  }
}

function getTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function getGitRepoName(): string {
  const repoUrlResult = child_process.spawnSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const repoUrl = repoUrlResult.stdout.trim();
  const repoMatch = repoUrl.match(/github\.com[\/:]([\w-]+\/[\w-]+)(\.git)?$/);
  return repoMatch ? repoMatch[1] : '';
}

function getHeaderOfFirstCommit(): string {
  const firstCommitResult = child_process.spawnSync('git', ['log', 'main..HEAD', '--reverse', '--pretty=%s'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return firstCommitResult.stdout.trim().split('\n')[0];
}
