/** VERA Intelligence Engine — domain contracts.
 *  Recommendations are DERIVED STATE: they exist while a condition holds and vanish
 *  when it is actually resolved. Providers propose ACTIONS, never raw information. */

export type RecommendationPriority = 'alta' | 'atencion' | 'lista';

export type WorkspaceSection =
  | 'information'
  | 'features'
  | 'amenities'
  | 'owner'
  | 'express'
  | 'channels'
  | 'tracking'
  | 'photos'
  | 'documents'
  | 'studio';

/** Abstract navigation contract. The provider says WHERE, the Workspace decides HOW. */
export interface WorkspaceRoute {
  entity: 'property';
  entityId: string;
  section: WorkspaceSection;
  focus?: string;
}

/** A single actionable recommendation, answering the 4 questions. */
export interface InboxRecommendation {
  id: string;
  priority: RecommendationPriority;
  subject: string; // what it is about (e.g. property title)
  title: string; // the action, imperative
  whatHappened: string; // ¿Qué pasó?
  whyItMatters: string; // ¿Por qué importa?
  recommendation: string; // ¿Qué recomienda VERA?
  impact: number; // lower = higher impact (sort within a tier)
  target: WorkspaceRoute;
}

/** VERA's "mood" — a serene reflection of the current operational state. */
export type VeraMood = 'serene' | 'active' | 'energy';

export interface IntelligenceResult {
  recommendations: InboxRecommendation[];
  mood: VeraMood;
}
