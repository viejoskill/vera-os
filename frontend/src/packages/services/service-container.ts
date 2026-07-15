/**
 * Composition Root — the ONLY place that wires concrete implementations together.
 * Swap a mock for a real implementation here and the entire app follows, untouched.
 */
import { InMemoryPropertyRepository } from '@vera/repositories';
import { PropertyService } from './property-service';
import { MockAIProvider } from './ai/mock-ai-provider';
import { AIService } from './ai/ai-service';

// --- Repositories (persistence) ---
const propertyRepository = new InMemoryPropertyRepository();
// Later: new SupabasePropertyRepository(client)

// --- AI Provider (integration) ---
const aiProvider = new MockAIProvider();
// Later: new OpenAIProvider(key) | new AnthropicProvider(key) | new GeminiProvider(key)

// --- Services (business logic) ---
export const propertyService = new PropertyService(propertyRepository);
export const aiService = new AIService(aiProvider);
