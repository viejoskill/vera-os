import type { ProcessingStage, StudioAnalysis } from '@vera/types';
import type { StudioProvider } from './studio-provider';

/**
 * StudioService — owns the photo-processing pipeline logic. Delegates the actual
 * "processing" to an injected {@link StudioProvider} (mock today).
 */
export class StudioService {
  constructor(private readonly provider: StudioProvider) {}

  getStages(): ProcessingStage[] {
    return this.provider.getStages();
  }

  analyze(photoCount: number): StudioAnalysis {
    return this.provider.analyze(photoCount);
  }
}
