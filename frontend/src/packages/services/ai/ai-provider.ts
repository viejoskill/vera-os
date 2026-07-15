/**
 * AIProvider — the abstraction that decouples VERA from any specific LLM vendor.
 * Concrete providers (Mock, OpenAI, Anthropic, Gemini) implement this interface;
 * the AIService and the rest of the system never change when the provider changes.
 */

export interface AICompletionRequest {
  prompt: string;
  system?: string;
}

export interface AICompletionResult {
  text: string;
  model: string;
  provider: string;
}

export interface AIProvider {
  readonly id: string;
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}
