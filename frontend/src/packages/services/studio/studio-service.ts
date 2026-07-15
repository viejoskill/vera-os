import type { ProcessingStage, StudioAnalysis } from '@vera/types';
import type { StudioProvider } from './studio-provider';

/**
 * StudioService — owns the photo-processing pipeline logic. Delegates the actual
 * "processing" to an injected {@link StudioProvider} (mock today).
 */
export class StudioService {
  constructor(private readonly provider: StudioProvider) {}

  readonly recommendedCount = 6;
  readonly recommendedOrder = [
    'Frente',
    'Living',
    'Cocina',
    'Dormitorio principal',
    'Baño',
    'Patio',
    'Plano',
  ];

  getStages(): ProcessingStage[] {
    return this.provider.getStages();
  }

  analyze(photoCount: number): StudioAnalysis {
    return this.provider.analyze(photoCount);
  }

  photoQuality(photoCount: number): string {
    if (photoCount === 0) return 'Sin fotos';
    return photoCount >= 6 ? 'Óptima' : photoCount >= 3 ? 'Buena' : 'A mejorar';
  }
}
