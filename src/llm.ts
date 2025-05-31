import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { type ModelMessage, generateText } from 'ai';
import type { ReasoningEffort } from './types.js';

const OPENAI_MODEL_PREFIXES = ['gpt-', 'o1', 'o3', 'o4'];

/**
 * Call LLM API using AI SDK 5
 */
export async function callLlmApi(
  model: string,
  messages: ModelMessage[],
  reasoningEffort?: ReasoningEffort
): Promise<string> {
  try {
    const modelInstance = getModelInstance(model);

    // Build the request parameters
    const requestParams: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      messages: messages,
    };

    // Add reasoning effort if specified (mainly for OpenAI o1 models)
    if (reasoningEffort !== undefined) {
      // For OpenAI models, reasoning effort is passed as a provider option
      if (OPENAI_MODEL_PREFIXES.some((p) => model.startsWith(p))) {
        requestParams.providerOptions = {
          openai: {
            reasoningEffort: reasoningEffort,
          },
        };
      }
      // Note: Google models don't currently support reasoning effort in the same way
    }

    const result = await generateText(requestParams);

    // Log the result for debugging (similar to original implementation)
    console.log(
      `${model}:`,
      JSON.stringify(
        {
          text: result.text,
          usage: result.usage,
          finishReason: result.finishReason,
        },
        null,
        2
      )
    );

    return result.text;
  } catch (error) {
    console.error(`LLM API error for model ${model}:`, error);
    process.exit(1);
  }
}

function getModelInstance(model: string): LanguageModelV2 {
  // Get the appropriate AI SDK model instance for the given model name
  if (model.startsWith('gemini-')) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(`GEMINI_API_KEY environment variable is not set for model: ${model}`);
      process.exit(1);
    }
    // Create Google provider with API key and return the model
    const googleProvider = createGoogleGenerativeAI({ apiKey });
    return googleProvider(model);
  }
  if (OPENAI_MODEL_PREFIXES.some((p) => model.startsWith(p))) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error(`OPENAI_API_KEY environment variable is not set for model: ${model}`);
      process.exit(1);
    }
    // Create OpenAI provider with API key and return the model
    const openaiProvider = createOpenAI({ apiKey });
    return openaiProvider(model);
  }

  console.error(`Unknown model: ${model}`);
  process.exit(1);
}
