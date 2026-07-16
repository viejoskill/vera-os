import type { InboxRecommendation } from '@vera/types';

/**
 * IntelligenceProvider — every VERA module contributes intelligence to the "Hoy"
 * Inbox through this single interface. The Inbox never knows the origin; it only
 * consumes a unified, prioritised list. New providers (Operations, Publications,
 * Documents, VeraStudio, AI) plug in without touching the "Hoy" screen.
 */
export interface IntelligenceProvider {
  readonly id: string;
  generate(): Promise<InboxRecommendation[]>;
}
