import { type BedrockProviderOptions, createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { type AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { type GoogleGenerativeAIProviderOptions, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { type OpenAIResponsesProviderOptions, createOpenAI } from '@ai-sdk/openai';
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
    const [modelInstance, provider, modelName] = getModelInstance(model);

    // Build the request parameters
    const requestParams: Parameters<typeof generateText>[0] = {
      model: modelInstance,
      messages: messages,
    };

    if (reasoningEffort) {
      // Check if the model supports reasoning/thinking features
      const modelSupportsReasoning = supportsReasoning(provider, modelName);

      if (!modelSupportsReasoning) {
        console.warn(
          `Model ${model} does not support reasoning/thinking features. Ignoring reasoning effort parameter.`
        );
      } else {
        const thinkingBudget = getThinkingBudget(reasoningEffort);
        if (provider === 'openai') {
          requestParams.providerOptions = {
            openai: {
              reasoningEffort: reasoningEffort as string,
            } satisfies OpenAIResponsesProviderOptions,
          };
        } else if (provider === 'anthropic') {
          requestParams.providerOptions = {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: thinkingBudget,
              },
            } satisfies AnthropicProviderOptions,
          };
        } else if (provider === 'google') {
          requestParams.providerOptions = {
            google: {
              thinkingConfig: {
                thinkingBudget,
              },
            } satisfies GoogleGenerativeAIProviderOptions,
          };
        } else if (provider === 'bedrock') {
          requestParams.providerOptions = {
            bedrock: {
              reasoningConfig: { type: 'enabled', budgetTokens: thinkingBudget },
            } satisfies BedrockProviderOptions,
          };
        }
      }
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
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/openai
      const openaiProvider = createOpenAI();
      return [openaiProvider(modelName), provider, modelName];
    }

    case 'anthropic': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
      const anthropicProvider = createAnthropic();
      return [anthropicProvider(modelName), provider, modelName];
    }

    case 'google': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
      const googleProvider = createGoogleGenerativeAI();
      return [googleProvider(modelName), provider, modelName];
    }

    case 'azure': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/azure
      const azureProvider = createAzure();
      return [azureProvider(modelName), provider, modelName];
    }

    case 'bedrock': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock
      const bedrockProvider = createAmazonBedrock();
      return [bedrockProvider(modelName), provider, modelName];
    }

    case 'vertex': {
      // cf. https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex
      const vertexProvider = createVertex();
      return [vertexProvider(modelName), provider, modelName];
    }

    default:
      console.error(
        `Unsupported provider: ${provider}. Supported providers: openai, azure, google, anthropic, bedrock, vertex`
      );
      process.exit(1);
  }
}

/**
 * Check if a model supports reasoning/thinking features
 */
export function supportsReasoning(provider: string, modelName: string): boolean {
  switch (provider) {
    case 'openai':
    case 'azure':
      // OpenAI and Azure: only o1, o3, o4 series models support reasoning effort
      return /^(o1|o3|o4)/.test(modelName);

    case 'anthropic':
      // Anthropic: only Claude 3.7 and Claude 4 models support thinking budget
      return /^claude-(opus-4|sonnet-4|3-7-sonnet)/.test(modelName);

    case 'google':
      // Google: only Gemini 2.5 models support thinking budget
      return /^gemini-2\.5/.test(modelName);

    case 'bedrock':
      // Bedrock: only Anthropic Claude 3.7 and 4 models support reasoning
      return /^(us\.)?anthropic\.claude-(opus-4|sonnet-4|3-7-sonnet)/.test(modelName);

    case 'vertex':
      // Vertex: Gemini 2.5 models and Claude 3.7/4 models support thinking budget
      return /^gemini-2\.5/.test(modelName) || /^claude-(3-7-sonnet|opus-4|sonnet-4)/.test(modelName);

    default:
      return false;
  }
}

/**
 * Get thinking budget token count based on reasoning effort level
 */
function getThinkingBudget(reasoningEffort: ReasoningEffort): number {
  const tokenBudgets = {
    low: 1000, // 1K tokens
    medium: 8000, // 8K tokens
    high: 24000, // 24K tokens
  };

  return tokenBudgets[reasoningEffort];
}
