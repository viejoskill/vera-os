/**
 * Composition Root — the ONLY place that wires concrete implementations together.
 * Swap a mock for a real implementation here and the entire app follows, untouched.
 */
import {
  ApiPropertyFilesGateway,
  ApiPropertyRepository,
} from '@vera/repositories';
import { PropertyService } from './property-service';
import { MockAIProvider } from './ai/mock-ai-provider';
import { AIService } from './ai/ai-service';
import { MockStudioProvider } from './studio/mock-studio-provider';
import { StudioService } from './studio/studio-service';
import { VeraAssistantService } from './assistant/assistant-service';
import { OwnerService } from './owner/owner-service';
import { WorkspaceService } from './workspace/workspace-service';

// --- Repositories & gateways (persistence lives behind the backend/Supabase) ---
const propertyRepository = new ApiPropertyRepository();
const propertyFilesGateway = new ApiPropertyFilesGateway();

// --- Providers (integrations) ---
const aiProvider = new MockAIProvider();
// Later: new OpenAIProvider(key) | new AnthropicProvider(key) | new GeminiProvider(key)
const studioProvider = new MockStudioProvider();
// Later: new RealImageStudioProvider(...)

// --- Services (business logic) ---
export const propertyService = new PropertyService(propertyRepository);
export const workspaceService = new WorkspaceService(propertyRepository, propertyFilesGateway);
export const aiService = new AIService(aiProvider);
export const studioService = new StudioService(studioProvider);
export const assistantService = new VeraAssistantService();
export const ownerService = new OwnerService();
