import child_process from 'node:child_process';
import ansis from 'ansis';
import YAML from 'yaml';
import { buildAiderArgs } from './aider.js';
import { configureEnvVars } from './env.js';
import { planCodeChanges } from './plan.js';
import { configureGitUserDetailsIfNeeded } from './profile.js';
import { runCommand, spawnAsync } from './spawn.js';
import { testAndFix } from './test.js';
import type { GitHubComment, GitHubIssue, ReasoningEffort } from './types.js';
import { stripHtmlComments } from './utils.js';

/**
 * Options for the main function
 */
export interface MainOptions {
  /** Additional arguments to pass to the aider command */
  aiderExtraArgs?: string;
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
  /** Command to run after Aider applies changes. If it fails, Aider will try to fix it. */
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

  await runCommand('python', ['-m', 'pip', 'install', 'aider-install']);
  try {
    // Make uv available on asdf environment
    await runCommand('asdf', ['reshim'], { ignoreExitStatus: true });
  } catch {
    // do nothing
  }
  await runCommand('uv', ['tool', 'uninstall', 'aider-chat'], { ignoreExitStatus: true });
  await runCommand('aider-install', []);

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

  const issueResult = await runCommand('gh', [
    'issue',
    'view',
    options.issueNumber.toString(),
    '--json',
    'author,title,body,labels,comments',
  ]);
  const issue: GitHubIssue = JSON.parse(issueResult);

  let prDiff = '';
  let isPR = false;

  try {
    // Use spawnAsync to get exit status and output for conditional logic
    const prCheckProcessResult = await spawnAsync('gh', [
      'pr',
      'view',
      options.issueNumber.toString(),
      '--json',
      'id', // Request a minimal field to confirm PR existence
    ]);

    if (prCheckProcessResult.status === 0 && prCheckProcessResult.stdout.trim()) {
      isPR = true;
      console.info(ansis.gray(`Input #${options.issueNumber} is a Pull Request. Fetching diff...`));
      const prDiffProcessResult = await spawnAsync('gh', ['pr', 'diff', options.issueNumber.toString()]);

      if (prDiffProcessResult.status === 0) {
        prDiff = prDiffProcessResult.stdout.trim();
        if (!prDiff) {
          console.info(ansis.gray(`PR #${options.issueNumber} has no diff.`));
        }
      } else {
        console.warn(
          ansis.yellow(
            `Could not fetch diff for PR #${options.issueNumber}. stderr: ${prDiffProcessResult.stderr.trim()}`
          )
        );
      }
    } else {
      console.info(
        ansis.gray(
          `Input #${options.issueNumber} is not a Pull Request or 'gh pr view' failed. stderr: ${prCheckProcessResult.stderr.trim()}`
        )
      );
    }
  } catch (error: any) {
    console.warn(ansis.yellow(`Error checking for PR or fetching diff for #${options.issueNumber}: ${error.message}`));
  }

  const cleanedIssueBody = stripHtmlComments(issue.body);
  // Rename issueObject to contextDataForLlm for clarity
  const contextDataForLlm: Record<string, any> = {
    author: issue.author.login,
    title: issue.title,
    description: cleanedIssueBody,
    comments: issue.comments.map((c: GitHubComment) => ({
      author: c.author.login,
      body: c.body,
    })),
  };

  if (isPR) {
    contextDataForLlm.isPullRequest = true;
    if (prDiff) {
      contextDataForLlm.codeChanges = prDiff;
    }
  }

  const issueText = YAML.stringify(contextDataForLlm).trim();
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
  const promptSubject = isPR ? 'GitHub Pull Request' : 'GitHub Issue';
  const prompt = `
Modify the code to address the following ${promptSubject}:
\`\`\`\`yml
${issueText}
\`\`\`\`
${planText ? `\n${planText}` : ''}
`.trim();
  console.log('Resolution plan:', resolutionPlan);

  const now = new Date();

  const branchName = `ai-pr-${options.issueNumber}-${now.getFullYear()}_${getTwoDigits(now.getMonth() + 1)}${getTwoDigits(now.getDate())}_${getTwoDigits(now.getHours())}${getTwoDigits(now.getMinutes())}${getTwoDigits(now.getSeconds())}`;
  if (!options.dryRun) {
    await runCommand('git', ['switch', '-C', branchName]);
  } else {
    console.info(ansis.yellow(`Would create branch: ${branchName}`));
  }

  // Build aider command arguments
  const aiderArgs = buildAiderArgs(options, { prompt: prompt, resolutionPlan });
  const aiderResult = await runCommand('aider', aiderArgs, {
    env: { ...process.env, NO_COLOR: '1' },
  });
  let aiderAnswer = aiderResult.trim();
  if (options.testCommand) {
    aiderAnswer += await testAndFix(options, resolutionPlan);
  }

  // Try commiting changes because aider may fail to commit changes due to pre-commit hooks
  await runCommand('git', ['commit', '-m', `fix: close #${options.issueNumber}`, '--no-verify'], {
    ignoreExitStatus: true,
  });
  if (!options.dryRun) {
    await runCommand('git', ['push', 'origin', branchName, '--no-verify']);
  } else {
    console.info(ansis.yellow(`Would push branch: ${branchName} to origin`));
  }

  // Create a PR using GitHub CLI
  const prTitle = getHeaderOfFirstCommit();
  let prBody = `Closes #${options.issueNumber}

${planText}
`;
  prBody += `
# Aider Log

\`\`\`\`
${aiderAnswer.slice(0, MAX_ANSWER_LENGTH - prBody.length)}
\`\`\`\``;
  prBody = prBody.replaceAll(/(?:\s*\n){2,}/g, '\n\n').trim();
  if (!options.dryRun) {
    const repoName = getGitRepoName();
    await runCommand('gh', ['pr', 'create', '--title', prTitle, '--body', prBody, '--repo', repoName]);
  } else {
    console.info(ansis.yellow(`Would create PR with title: ${prTitle}`));
    console.info(ansis.yellow(`PR body would include the aider response and close issue #${options.issueNumber}`));
  }

  console.info(`\nIssue #${options.issueNumber} processed successfully.`);
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
