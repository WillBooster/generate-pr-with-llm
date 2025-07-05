import fs from 'node:fs';
import type { ModelMessage } from 'ai';
import YAML from 'yaml';
import { DEFAULT_REPOMIX_EXTRA_ARGS } from './defaultOptions.js';
import { callLlmApi } from './llm.js';
import { extractHeaderContents, findDistinctFence, trimCodeBlockFences } from './markdown.js';
import { runCommand } from './spawn.js';
import type { IssueInfo, ReasoningEffort } from './types.js';
import { parseCommandLineArgs } from './utils.js';

const REPOMIX_FILE_NAME = 'repomix.result';

export type ResolutionPlan = {
  plan?: string;
  filePaths: string[];
};

const HEADING_OF_FILE_PATHS_TO_BE_MODIFIED = '# File Paths to be Modified';
const HEADING_OF_FILE_PATHS_TO_BE_REFERRED = '# File Paths to be Referred';
const HEADING_OF_PLAN = '# Implementation Plans';

export async function planCodeChanges(
  model: string,
  issueInfo: IssueInfo,
  issueContent: string,
  twoStagePlanning: boolean,
  reasoningEffort?: ReasoningEffort,
  repomixExtraArgs?: string
): Promise<ResolutionPlan> {
  const issueFence = findDistinctFence(issueContent);

  // Base repomix command arguments
  const repomixArgs = ['--yes', 'repomix@latest', '--output', REPOMIX_FILE_NAME];
  repomixArgs.push(...parseCommandLineArgs(repomixExtraArgs || DEFAULT_REPOMIX_EXTRA_ARGS));

  await runCommand('npx', repomixArgs);
  const repomixResult = fs.readFileSync(REPOMIX_FILE_NAME, 'utf8');
  void fs.promises.rm(REPOMIX_FILE_NAME, { force: true });

  const imageUrls = [
    ...(issueInfo.images || []),
    ...(issueInfo.comments?.flatMap((c) => c.images || []) || []),
  ];

  if (twoStagePlanning) {
    console.info(`Selecting files with ${model} (reasoning effort: ${reasoningEffort}) ...`);
    const filesResponse = await callLlmApi(
      model,
      buildMultimodalMessages(
        buildPromptForSelectingFiles(issueFence, issueContent).trim(),
        repomixResult,
        imageUrls
      ),
      reasoningEffort
    );
    console.info('Selecting complete!');

    const extractedFilePathLists = extractHeaderContents(trimCodeBlockFences(filesResponse), [
      HEADING_OF_FILE_PATHS_TO_BE_MODIFIED,
      HEADING_OF_FILE_PATHS_TO_BE_REFERRED,
    ]);
    if (!extractedFilePathLists) {
      return { filePaths: [] };
    }
    const [filePathsToBeModified, filePathsToBeReferred] = extractedFilePathLists.map((filesContent: string) => {
      const filePathRegex = /\B-\s*`?([^`\n]+)`?/g;
      const matches = [...filesContent.matchAll(filePathRegex)];
      return matches.map((match) => match[1].trim());
    });

    const fileContents = [...filePathsToBeModified, ...filePathsToBeReferred]
      .map((filePath) => {
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
        const fence = findDistinctFence(content);
        return `# \`${filePath}\`

${fence}
${content}
${fence}`;
      })
      .join('\n\n');

    console.info(`Planning code changes with ${model} (reasoning effort: ${reasoningEffort}) ...`);
    const planResponse = await callLlmApi(
      model,
      buildMultimodalMessages(buildPromptForPlanningCodeChanges(issueFence, issueContent), fileContents, imageUrls),
      reasoningEffort
    );
    console.info('Planning complete!');

    const extractedPlans = extractHeaderContents(trimCodeBlockFences(planResponse), [HEADING_OF_PLAN]);
    if (!extractedPlans) {
      return { filePaths: [] };
    }
    return { plan: extractedPlans[0], filePaths: filePathsToBeModified };
  }
  console.info(`Planning code changes with ${model} (reasoning effort: ${reasoningEffort}) ...`);
  const filesResponse = await callLlmApi(
    model,
    buildMultimodalMessages(
      buildPromptForSelectingFilesAndPlanningCodeChanges(issueFence, issueContent).trim(),
      repomixResult,
      imageUrls
    ),
    reasoningEffort
  );
  console.info('Planning complete!');

  const extractedFilePathLists = extractHeaderContents(trimCodeBlockFences(filesResponse), [
    HEADING_OF_PLAN,
    HEADING_OF_FILE_PATHS_TO_BE_MODIFIED,
  ]);
  if (!extractedFilePathLists) {
    return { filePaths: [] };
  }

  const filePathRegex = /\B-\s*`?([^`\n]+)`?/g;
  const matches = [...extractedFilePathLists[1].matchAll(filePathRegex)];
  const filePathsToBeModified = matches.map((match) => match[1].trim());
  return { plan: extractedFilePathLists[0], filePaths: filePathsToBeModified };
}

function buildMultimodalMessages(
  systemContent: string,
  userContent: string,
  imageUrls: string[]
): ModelMessage[] {
  const messages: ModelMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: [{ type: 'text', text: userContent }] },
  ];
  if (imageUrls.length > 0) {
    const userMessage = messages.find((m) => m.role === 'user');
    if (userMessage && Array.isArray(userMessage.content)) {
      for (const url of imageUrls) {
        try {
          (userMessage.content as unknown[]).push({ type: 'image', image: new URL(url) });
        } catch (error) {
          console.warn(`Invalid image URL, skipping: ${url}`);
        }
      }
    }
  }
  return messages;
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
\`\`\`md
${HEADING_OF_FILE_PATHS_TO_BE_MODIFIED}

- \`<filePath1>\`
- \`<filePath2>\`
- ...

${HEADING_OF_FILE_PATHS_TO_BE_REFERRED}

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
- Focus on implementation details for each file that needs modification
- Be clear and actionable for a developer to follow
- Prefer showing diffs rather than complete file contents when describing changes
- Exclude testing procedures unless users explicitly request

GitHub Issue:
${issueFence}yml
${YAML.stringify(issueContent).trim()}
${issueFence}

Please format your response without any explanatory text as follows:
\`\`\`md
${HEADING_OF_PLAN}

1. <Specific implementation step>
2. <Next implementation step>
...
\`\`\`
`.trim();
}

function buildPromptForSelectingFilesAndPlanningCodeChanges(issueFence: string, issueContent: string): string {
  return `
You are an expert software developer tasked with analyzing GitHub issues and creating implementation plans.

Review the following GitHub issue and the list of available file paths and their contents (which will be provided in a separate message).
Your task is to:
1. Create a detailed, step-by-step plan outlining how to resolve the issue effectively
2. Identify files that need to be modified to resolve the issue

Your plan should:
- Focus on implementation details for each file that needs modification
- Be clear and actionable for a developer to follow
- Prefer showing diffs rather than complete file contents when describing changes
- Exclude testing procedures as those will be handled separately

GitHub Issue:
${issueFence}yml
${YAML.stringify(issueContent).trim()}
${issueFence}

Please format your response without any explanatory text as follows:
\`\`\`md
${HEADING_OF_PLAN}

1. <Specific implementation step>
2. <Next implementation step>
...

${HEADING_OF_FILE_PATHS_TO_BE_MODIFIED}

- \`<filePath1>\`
- \`<filePath2>\`
- ...
\`\`\`
`;
}
