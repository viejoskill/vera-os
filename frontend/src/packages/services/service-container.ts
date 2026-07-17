/**
 * Composition Root — the ONLY place that wires concrete implementations together.
 * Swap a mock for a real implementation here and the entire app follows, untouched.
 */
import {
  ApiAiContentGateway,
  ApiPropertyFilesGateway,
  ApiPropertyRepository,
  ApiPublicationGateway,
} from '@vera/repositories';
import { PropertyService } from './property-service';
import { MockStudioProvider } from './studio/mock-studio-provider';
import { StudioService } from './studio/studio-service';
import { VeraAssistantService } from './assistant/assistant-service';
import { OwnerService } from './owner/owner-service';
import { AiContentService } from './ai/ai-content-service';
import { PublicationService } from './publication/publication-service';
import { WorkspaceService } from './workspace/workspace-service';
import { VeraIntelligenceEngine } from './intelligence/vera-intelligence-engine';
import { PropertiesProvider } from './intelligence/properties-provider';
import { IntelligenceService } from './intelligence/intelligence-service';

// --- Repositories & gateways (persistence lives behind the backend/Supabase) ---
const propertyRepository = new ApiPropertyRepository();
export const propertyFilesGateway = new ApiPropertyFilesGateway();

// --- Providers (integrations) ---
const studioProvider = new MockStudioProvider();
// Later: new RealImageStudioProvider(...)

// --- Services (business logic) ---
export const propertyService = new PropertyService(propertyRepository);
export const workspaceService = new WorkspaceService(propertyRepository, propertyFilesGateway);
export const studioService = new StudioService(studioProvider);
export const assistantService = new VeraAssistantService();
export const ownerService = new OwnerService();
export const aiContentService = new AiContentService(new ApiAiContentGateway());
export const publicationService = new PublicationService(new ApiPublicationGateway());

// --- VERA Intelligence Engine + Providers (the "Hoy" Inbox) ---
const veraIntelligenceEngine = new VeraIntelligenceEngine();
export const intelligenceService = new IntelligenceService(
  [new PropertiesProvider(propertyService, assistantService)],
  veraIntelligenceEngine,
);
