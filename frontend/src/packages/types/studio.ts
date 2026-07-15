/** Vera Studio types — simulated photo processing pipeline. */

export type PhotoStatus = 'uploading' | 'processing' | 'ready';

export interface PhotoAsset {
  id: string;
  name: string;
  url: string;
  status: PhotoStatus;
  isCover: boolean;
  file?: File;
}

export interface ProcessingStage {
  id: string;
  label: string;
}

export type StageState = 'pending' | 'running' | 'done';

export interface StudioAnalysis {
  suggestedCoverIndex: number;
  detectedRooms: string[];
  duplicatesRemoved: number;
}
