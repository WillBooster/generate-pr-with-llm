import type { Message, ModelMessage } from 'ai';
import type { LanguageModelV1 } from 'ai-v4';
import { createOllama } from 'ollama-ai-provider-v2';
import { logResult, supportsReasoning } from './llm.js';
import type { ReasoningEffort } from './types.js';

/**
 * Convert AI SDK v5 ModelMessage[] to AI SDK v4 Message[] format
 */
function convertToV4Messages(messages: ModelMessage[]): Message[] {
  return messages.map((msg, index) => ({
    id: `msg-${index}`,
    role: msg.role === 'tool' ? 'data' : msg.role,
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }));
}

/**
 * Call AI SDK v4 provider API (for OpenRouter and Ollama)
 */
export async function callV4ProviderApi(
  model: string,
  messages: ModelMessage[],
  reasoningEffort?: ReasoningEffort
): Promise<string> {
  try {
    const [provider, ...modelParts] = model.split('/');
    const modelName = modelParts.join('/'); // Handle cases where model name itself contains '/'

    if (!modelName) {
      console.error(`Invalid ${provider} model format: ${model}. Expected format: ${provider}/model-name`);
      process.exit(1);
    }

    // Import AI SDK v4
    const { generateText: generateTextV4 } = await import('ai-v4');

    // Convert messages to v4 format
    const v4Messages = convertToV4Messages(messages);

    // Create provider and model based on type
    let providerModel: LanguageModelV1;
    if (provider === 'openrouter') {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: {
          'HTTP-Referer': 'https://github.com/WillBooster/gen-pr',
          'X-Title': 'gen-pr',
        },
      });
      providerModel = openrouter(modelName);
    } else if (provider === 'ollama') {
      const ollamaBaseURL = `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api`;
      const ollama = createOllama({
        baseURL: ollamaBaseURL,
        ...(process.env.OLLAMA_API_KEY && { apiKey: process.env.OLLAMA_API_KEY }),
      });
      // Add thinking mode for reasoning-capable models
      const modelSupportsReasoning = supportsReasoning('ollama', modelName);
      const ollamaOptions: { think?: boolean } = {};
      if (reasoningEffort && modelSupportsReasoning) {
        ollamaOptions.think = true;
      }
      providerModel = ollama(modelName, ollamaOptions);
    } else {
      throw new Error(`Unsupported v4 provider: ${provider}`);
    }

    // Generate text
    const result = await generateTextV4({
      model: providerModel,
      messages: v4Messages,
    });

    // Log result
    logResult(model, result);

    return result.text;
  } catch (error) {
    const [provider] = model.split('/');
    console.error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API error for model ${model}:`, error);
    process.exit(1);
  }
}
