import type { IntelligenceResult } from '@vera/types';
import type { IntelligenceProvider } from './intelligence-provider';
import type { VeraIntelligenceEngine } from './vera-intelligence-engine';

/**
 * IntelligenceService — aggregates every registered provider into a single,
 * prioritised Inbox. The "Hoy" App consumes only this. Adding a new module means
 * registering its provider here; the screen never changes.
 */
export class IntelligenceService {
  constructor(
    private readonly providers: IntelligenceProvider[],
    private readonly engine: VeraIntelligenceEngine,
  ) {}

  async analyze(): Promise<IntelligenceResult> {
    const batches = await Promise.all(this.providers.map((p) => p.generate()));
    return this.engine.compose(batches.flat());
  }
}
