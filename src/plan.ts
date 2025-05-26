import fs from 'node:fs';
import YAML from 'yaml';
import { callLlmApi, getApiUrlAndKey } from './llm';
import type { ReasoningEffort } from './types';
import { parseCommandLineArgs } from './utils';

import { DEFAULT_REPOMIX_EXTRA_ARGS } from './defaultOptions';
import { extractHeaderContents, findDistinctFence, trimCodeBlockFences } from './markdown';
import { runCommand } from './spawn';

const REPOMIX_FILE_NAME = 'repomix.result';

export type ResolutionPlan = {
  plan?: string;
  filePaths: string[];
};

export async function planCodeChanges(
  model: string,
  issueContent: string,
  detailedPlan: boolean,
  reasoningEffort?: ReasoningEffort,
  repomixExtraArgs?: string
): Promise<ResolutionPlan> {
  const { url, apiKey } = getApiUrlAndKey(model);

  const issueFence = findDistinctFence(issueContent);

  // Base repomix command arguments
  const repomixArgs = ['--yes', 'repomix@latest', '--output', REPOMIX_FILE_NAME];
  repomixArgs.push(...parseCommandLineArgs(repomixExtraArgs || DEFAULT_REPOMIX_EXTRA_ARGS));

  await runCommand('npx', repomixArgs);
  const repomixResult = fs.readFileSync(REPOMIX_FILE_NAME, 'utf8');
  void fs.promises.rm(REPOMIX_FILE_NAME, { force: true });

  console.info(`Selecting files with ${model} (reasoning effort: ${reasoningEffort}) ...`);
  const filesResponse = await callLlmApi(
    url,
    apiKey,
    model,
    [
      {
        role: 'system',
        content: buildPromptForSelectingFiles(issueFence, issueContent).trim(),
      },
      {
        role: 'user',
        content: repomixResult,
      },
    ],
    reasoningEffort
  );
  console.info('Selecting complete!');

  const extractedFilePathLists = extractHeaderContents(trimCodeBlockFences(filesResponse), [
    '# File Paths to be Modified',
    '# File Paths to be Referred',
  ]);
  if (!extractedFilePathLists) {
    return { filePaths: [] };
  }
  const [filePathsToBeModified, filePathsToBeReferred] = extractedFilePathLists.map((filesContent) => {
    const filePathRegex = /\B-\s*`?([^`\n]+)`?/g;
    const matches = [...filesContent.matchAll(filePathRegex)];
    return matches.map((match) => match[1].trim());
  });
  if (!detailedPlan) {
    return { filePaths: filePathsToBeModified };
  }

  const fileContents = [...filePathsToBeModified, ...filePathsToBeReferred]
    .map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      const fence = findDistinctFence(content);
      return `# \`${filePath}\`

${fence}
${content}
${fence}`;
    })
    .join('\n\n');

  console.info(`Planning code changes with ${model} (reasoning effort: ${reasoningEffort}) ...`);
  const planResponse = await callLlmApi(
    url,
    apiKey,
    model,
    [
      {
        role: 'system',
        content: buildPromptForPlanningCodeChanges(issueFence, issueContent),
      },
      {
        role: 'user',
        content: fileContents,
      },
    ],
    reasoningEffort
  );
  console.info('Planning complete!');

  const extractedPlans = extractHeaderContents(trimCodeBlockFences(planResponse), ['# Implementation Plans']);
  if (!extractedPlans) {
    return { filePaths: [] };
  }
  return { plan: extractedPlans[0], filePaths: filePathsToBeModified };
}

function buildPromptForSelectingFiles(issueFence: string, issueContent: string): string {
  return `
You are an expert software developer tasked with analyzing GitHub issues and identifying relevant files for code changes.

Review the following GitHub issue and the list of available file paths and their contents (which will be provided in a separate message).
Your task is to identify:
1. Files that need to be MODIFIED to resolve the issue
2. Files that should be REFERRED to (but not modified) to understand the codebase better

GitHub Issue:
${issueFence}yml
${YAML.stringify(issueContent).trim()}
${issueFence}

Please format your response without any explanatory text as follows:
\`\`\`
# File Paths to be Modified

- \`<filePath1>\`
- \`<filePath2>\`
- ...

# File Paths to be Referred

- \`<filePath1>\`
- \`<filePath2>\`
- ...
\`\`\`
`;
}

function buildPromptForPlanningCodeChanges(issueFence: string, issueContent: string): string {
  return `
You are an expert software developer tasked with creating implementation plans based on GitHub issues.

Review the following GitHub issue and the provided file contents (which will be provided in a separate message).
Create a detailed, step-by-step plan outlining how to address the issue effectively.

Your plan should:
1. Focus on implementation details for each file that needs modification
2. Be clear and actionable for a developer to follow
3. Exclude testing procedures as those will be handled separately

GitHub Issue:
${issueFence}yml
${YAML.stringify(issueContent).trim()}
${issueFence}

Please format your response without any explanatory text as follows:
\`\`\`
# Implementation Plans

1. <Specific implementation step>
2. <Next implementation step>
...
\`\`\`
`.trim();
}
