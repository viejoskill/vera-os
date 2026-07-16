import type { InboxRecommendation, IntelligenceResult, VeraMood } from '@vera/types';

const TIER_ORDER: Record<InboxRecommendation['priority'], number> = {
  alta: 0,
  atencion: 1,
  lista: 2,
};

/**
 * VERA Intelligence Engine (VIE) — the core that turns detected situations into
 * prioritised, explainable recommendations. Deterministic, auditable, reproducible.
 * A future LLM may only improve wording — never the priority or the action.
 */
export class VeraIntelligenceEngine {
  /** Global ordering: by tier (🔴→🟡→🟢), then by impact within the tier. */
  prioritize(recommendations: InboxRecommendation[]): InboxRecommendation[] {
    return [...recommendations].sort((a, b) => {
      if (TIER_ORDER[a.priority] !== TIER_ORDER[b.priority]) {
        return TIER_ORDER[a.priority] - TIER_ORDER[b.priority];
      }
      return a.impact - b.impact;
    });
  }

  /** VERA's mood is a calm reflection of how much needs attention. */
  mood(recommendations: InboxRecommendation[]): VeraMood {
    if (recommendations.some((r) => r.priority === 'alta')) return 'energy';
    if (recommendations.some((r) => r.priority === 'atencion')) return 'active';
    return 'serene';
  }

  compose(recommendations: InboxRecommendation[]): IntelligenceResult {
    const ordered = this.prioritize(recommendations);
    return { recommendations: ordered, mood: this.mood(ordered) };
  }
}
