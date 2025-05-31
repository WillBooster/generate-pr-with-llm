import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { type ModelMessage, generateText } from 'ai';
import type { ReasoningEffort } from './types.js';

/**
 * Call LLM API using AI SDK 5
 */
export async function callLlmApi(
  model: string,
  messages: ModelMessage[],
  reasoningEffort?: ReasoningEffort
): Promise<string> {
  try {
    const [modelInstance, provider] = getModelInstance(model);

    // Build the request parameters
    const requestParams: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      messages: messages,
    };

    if (reasoningEffort !== undefined && provider === 'openai') {
      requestParams.providerOptions = {
        openai: {
          reasoningEffort: reasoningEffort as string,
        },
      };
      // Note: Google and Anthropic models don't currently support reasoning effort in the same way
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

function getModelInstance(model: string): [LanguageModelV2, string, string] {
  // Only support llmlite format (provider/model)
  if (!model.includes('/')) {
    console.error(`Model must be in format 'provider/model'. Got: ${model}`);
    process.exit(1);
  }

  const [provider, ...modelParts] = model.split('/');
  const modelName = modelParts.join('/'); // Handle cases where model name itself contains '/'

  switch (provider) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error(`OPENAI_API_KEY environment variable is not set for model: ${model}`);
        process.exit(1);
      }
      const openaiProvider = createOpenAI({ apiKey });
      return [openaiProvider(modelName), provider, modelName];
    }

    case 'google': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error(`GEMINI_API_KEY environment variable is not set for model: ${model}`);
        process.exit(1);
      }
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      return [googleProvider(modelName), provider, modelName];
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(`ANTHROPIC_API_KEY environment variable is not set for model: ${model}`);
        process.exit(1);
      }
      const anthropicProvider = createAnthropic({ apiKey });
      return [anthropicProvider(modelName), provider, modelName];
    }

    default:
      console.error(`Unsupported provider: ${provider}. Supported providers: openai, google, anthropic`);
      process.exit(1);
  }
}
