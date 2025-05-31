import { describe, expect, test } from 'bun:test';
import type { ModelMessage } from 'ai';
import { callLlmApi } from '../../src/llm.js';

describe('callLlmApi', () => {
  const testMessages: ModelMessage[] = [{ role: 'user', content: 'Say only `Hi`' }];

  // Note: These are integration tests that require actual API keys
  // They will be skipped if the required environment variables are not set

  test.skipIf(!process.env.OPENAI_API_KEY)(
    'should call OpenAI API successfully',
    async () => {
      const result = await callLlmApi('openai/gpt-4.1', testMessages);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hi');
    },
    10000
  );

  test.skipIf(!process.env.AZURE_OPENAI_API_KEY)(
    'should call Azure OpenAI API successfully',
    async () => {
      const result = await callLlmApi('azure/gpt-4.1', testMessages);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hi');
    },
    10000
  );

  test.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)(
    'should call Google Gemini API successfully',
    async () => {
      const result = await callLlmApi('google/gemini-2.5-pro-preview-05-06', testMessages);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hi');
    },
    10000
  );

  test.skipIf(!process.env.ANTHROPIC_API_KEY)(
    'should call Anthropic API successfully',
    async () => {
      const result = await callLlmApi('anthropic/claude-4-sonnet-latest', testMessages);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hi');
    },
    10000
  );

  test.skipIf(!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)(
    'should call AWS Bedrock API successfully',
    async () => {
      const result = await callLlmApi('bedrock/us.anthropic.claude-sonnet-4-20250514-v1:0', testMessages);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hi');
    },
    15000
  );

  test.skipIf(!process.env.GOOGLE_APPLICATION_CREDENTIALS)(
    'should call Google Vertex AI API successfully',
    async () => {
      const result = await callLlmApi('vertex/gemini-2.5-pro-preview-05-06', testMessages);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toContain('hi');
    },
    10000
  );

  describe('basic functionality', () => {
    test.skipIf(!process.env.OPENAI_API_KEY)(
      'should work with OpenAI o4 models',
      async () => {
        const result = await callLlmApi('openai/o4-mini', testMessages);

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );

    test.skipIf(!process.env.AZURE_OPENAI_API_KEY)(
      'should work with Azure OpenAI o4 models',
      async () => {
        const result = await callLlmApi('azure/o4-mini', testMessages);

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );

    test.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)(
      'should work with Google Gemini Flash models',
      async () => {
        const result = await callLlmApi('google/gemini-2.5-flash-preview-05-20', testMessages);

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      10000
    );

    test.skipIf(!process.env.ANTHROPIC_API_KEY)(
      'should work with Anthropic Haiku models',
      async () => {
        const result = await callLlmApi('anthropic/claude-3-5-haiku-latest', testMessages);

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      10000
    );

    test.skipIf(!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)(
      'should work with AWS Bedrock Haiku models',
      async () => {
        const result = await callLlmApi('bedrock/us.anthropic.claude-3-5-haiku-20241022-v1:0', testMessages);

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      15000
    );

    test.skipIf(!process.env.GOOGLE_APPLICATION_CREDENTIALS)(
      'should work with Google Vertex AI Flash models',
      async () => {
        const result = await callLlmApi('vertex/gemini-2.5-flash-preview-05-20', testMessages);

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      10000
    );
  });

  describe('reasoning effort with thinking budget', () => {
    test.skipIf(!process.env.OPENAI_API_KEY)(
      'should work with OpenAI reasoning effort low',
      async () => {
        const result = await callLlmApi('openai/o4-mini', testMessages, 'low');

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );

    test.skipIf(!process.env.OPENAI_API_KEY)(
      'should work with OpenAI reasoning effort medium',
      async () => {
        const result = await callLlmApi('openai/o4-mini', testMessages, 'medium');

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );

    test.skipIf(!process.env.OPENAI_API_KEY)(
      'should work with OpenAI reasoning effort high',
      async () => {
        const result = await callLlmApi('openai/o4-mini', testMessages, 'high');

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );

    test.skipIf(!process.env.AZURE_OPENAI_API_KEY)(
      'should work with Azure OpenAI reasoning effort',
      async () => {
        const result = await callLlmApi('azure/o4-mini', testMessages, 'medium');

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );

    test.skipIf(!process.env.GOOGLE_GENERATIVE_AI_API_KEY)(
      'should work with Google thinking budget',
      async () => {
        // Test Google thinking models with thinking budget
        const result = await callLlmApi('google/gemini-2.5-flash-preview-04-17', testMessages, 'medium');

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      10000
    );

    test.skipIf(!process.env.ANTHROPIC_API_KEY)(
      'should work with Anthropic reasoning effort',
      async () => {
        // Test Anthropic reasoning models with thinking budget
        const result = await callLlmApi('anthropic/claude-4-sonnet-20250514', testMessages, 'medium');

        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('hi');
      },
      30000
    );
  });

  describe('error handling', () => {
    test('should handle API errors gracefully', async () => {
      // This test verifies that API errors are caught and logged
      const originalConsoleError = console.error;
      const originalProcessExit = process.exit;

      let errorLogged = false;
      let exitCalled = false;

      console.error = () => {
        errorLogged = true;
      };

      process.exit = () => {
        exitCalled = true;
        throw new Error('process.exit called');
      };

      try {
        // This should fail because 'invalid' is not a supported provider
        await callLlmApi('invalid/model', testMessages);
        expect.unreachable('Should have thrown an error');
      } catch (error) {
        expect(errorLogged).toBe(true);
        expect(exitCalled).toBe(true);
      } finally {
        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      }
    });
  });
});
