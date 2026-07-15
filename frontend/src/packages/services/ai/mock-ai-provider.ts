import type { AICompletionRequest, AICompletionResult, AIProvider } from './ai-provider';

/**
 * Mock AI provider. Deterministic, offline, zero-cost.
 * Echoes the composed prompt so the rest of the system can be validated end-to-end.
 * Replace with OpenAI/Anthropic/Gemini providers implementing {@link AIProvider}.
 */
export class MockAIProvider implements AIProvider {
  readonly id = 'mock';

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return {
      text: `${request.prompt}`,
      model: 'vera-mock-1',
      provider: this.id,
    };
  }
}
