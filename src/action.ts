import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import core from '@actions/core';
import { DEFAULT_CODE_ASSISTANT, DEFAULT_MAX_TEST_ATTEMPTS } from './defaultOptions.js';
import { main } from './main.js';
import type { CodeAssistant, ReasoningEffort } from './types.js';

// Get inputs
const issueNumber = core.getInput('issue-number', { required: true });
const planningModel = core.getInput('planning-model', { required: false });
const twoStagePlanning = core.getInput('two-staged-planning', { required: false }) !== 'false';
const reasoningEffort = core.getInput('reasoning-effort', { required: false }) as ReasoningEffort | undefined;
const dryRun = core.getInput('dry-run', { required: false }) === 'true';
const codeAssistant = (core.getInput('code-assistant', { required: false }) || DEFAULT_CODE_ASSISTANT) as CodeAssistant;
const aiderExtraArgs = core.getInput('aider-extra-args', { required: false });
const repomixExtraArgs = core.getInput('repomix-extra-args', { required: false });
const testCommand = core.getInput('test-command', { required: false });
const maxTestAttemptsInput = core.getInput('max-test-attempts', { required: false });
const maxTestAttempts = maxTestAttemptsInput ? Number.parseInt(maxTestAttemptsInput, 10) : DEFAULT_MAX_TEST_ATTEMPTS;

if (reasoningEffort && !['low', 'medium', 'high'].includes(reasoningEffort)) {
  console.error(
    `Invalid reasoning-effort value: ${reasoningEffort}. Using default. Valid values are: low, medium, high`
  );
  process.exit(1);
}

if (!['aider', 'claude-code'].includes(codeAssistant)) {
  console.error(`Invalid code-assistant value: ${codeAssistant}. Using default. Valid values are: aider, claude-code`);
  process.exit(1);
}

// cf. https://github.com/cli/cli/issues/8441#issuecomment-1870271857
fs.rmSync(path.join(os.homedir(), '.config', 'gh'), { force: true, recursive: true });

void main({
  aiderExtraArgs,
  codeAssistant,
  twoStagePlanning,
  dryRun,
  issueNumber: Number(issueNumber),
  maxTestAttempts,
  planningModel,
  reasoningEffort,
  repomixExtraArgs,
  testCommand,
});
