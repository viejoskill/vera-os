import type { ProcessingStage, StudioAnalysis } from '@vera/types';
import type { StudioProvider } from './studio-provider';

const STAGES: ProcessingStage[] = [
  { id: 'lighting', label: 'Mejorando iluminación' },
  { id: 'perspective', label: 'Corrigiendo perspectiva' },
  { id: 'rooms', label: 'Detectando ambientes' },
  { id: 'duplicates', label: 'Eliminando duplicadas' },
  { id: 'cover', label: 'Sugiriendo portada' },
];

const ROOM_POOL = ['Living', 'Cocina', 'Dormitorio principal', 'Baño', 'Comedor', 'Balcón'];

/** Deterministic, offline simulation of Vera Studio image processing. */
export class MockStudioProvider implements StudioProvider {
  readonly id = 'mock';

  getStages(): ProcessingStage[] {
    return [...STAGES];
  }

  analyze(photoCount: number): StudioAnalysis {
    return {
      suggestedCoverIndex: photoCount > 0 ? 0 : -1,
      detectedRooms: ROOM_POOL.slice(0, Math.min(photoCount, ROOM_POOL.length)),
      duplicatesRemoved: photoCount > 3 ? 1 : 0,
    };
  }
}
