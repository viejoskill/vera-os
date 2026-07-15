/** Vera Assistant types — simulated publication intelligence. */

export interface QualityScore {
  score: number; // 0–100
  label: string;
}

export interface Recommendation {
  id: string;
  text: string;
  done: boolean;
}

export interface VeraInsights {
  quality: QualityScore;
  detectedRooms: string[];
  missingFields: string[];
  recommendations: Recommendation[];
}
