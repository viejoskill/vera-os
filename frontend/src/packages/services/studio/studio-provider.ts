import type { ProcessingStage, StudioAnalysis } from '@vera/types';

/**
 * StudioProvider — abstracts the image-processing backend.
 * Today a mock; tomorrow a real image-AI service implements this interface.
 */
export interface StudioProvider {
  readonly id: string;
  getStages(): ProcessingStage[];
  analyze(photoCount: number): StudioAnalysis;
}
