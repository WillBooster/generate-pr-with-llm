import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
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

    if (reasoningEffort !== undefined && (provider === 'openai' || provider === 'azure')) {
      if (provider === 'openai') {
        requestParams.providerOptions = {
          openai: {
            reasoningEffort: reasoningEffort as string,
          },
        };
      } else if (provider === 'azure') {
        requestParams.providerOptions = {
          azure: {
            reasoningEffort: reasoningEffort as string,
          },
        };
      }
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

function getModelInstance(model: string): [LanguageModelV2, string] {
  // Only support llmlite format (provider/model)
  if (!model.includes('/')) {
    console.error(`Model must be in format 'provider/model'. Got: ${model}`);
    process.exit(1);
  }

  const [provider, ...modelParts] = model.split('/');
  const modelName = modelParts.join('/'); // Handle cases where model name itself contains '/'

  switch (provider) {
    case 'openai': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/openai
      const openaiProvider = createOpenAI();
      return [openaiProvider(modelName), provider];
    }

    case 'anthropic': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
      const anthropicProvider = createAnthropic();
      return [anthropicProvider(modelName), provider];
    }

    case 'google': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
      const googleProvider = createGoogleGenerativeAI();
      return [googleProvider(modelName), provider];
    }

    case 'azure': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/azure
      const azureProvider = createAzure();
      return [azureProvider(modelName), provider];
    }

    case 'bedrock': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock
      const bedrockProvider = createAmazonBedrock();
      return [bedrockProvider(modelName), provider];
    }

    case 'vertex': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex
      const vertexProvider = createVertex();
      return [vertexProvider(modelName), provider];
    }

    default:
      console.error(
        `Unsupported provider: ${provider}. Supported providers: openai, azure, google, anthropic, bedrock, vertex`
      );
      process.exit(1);
  }
}
