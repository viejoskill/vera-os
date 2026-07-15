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

/** A single item in the publication readiness checklist. */
export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  optional: boolean;
}

/** Health Score presented as a diagnosis, not just a number. */
export interface HealthDiagnosis {
  score: number; // 0–100
  label: string; // Excelente | Muy buena | Atención | Incompleta
  message: string; // calm, guiding sentence
}

/** Full assessment of the property workspace. */
export interface WorkspaceAssessment {
  completion: number; // 0–100, overall progress
  status: 'ready' | 'preparing';
  health: HealthDiagnosis;
  checklist: ChecklistItem[];
  /** The single most valuable next action, phrased as guidance. */
  nextStep: string | null;
}
