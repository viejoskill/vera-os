import type {
  AiContentGateway,
  AiContentMode,
  AiPropertyContext,
} from '@vera/repositories';

/**
 * AiContentService — orchestrates VERA's content suggestions. Business rule:
 * VERA PROPONE, el profesional decide — this service only returns suggestions,
 * it never mutates the property. Reusable across modes (title today; description /
 * highlights / portal variants later) through the same gateway.
 */
export class AiContentService {
  constructor(private readonly gateway: AiContentGateway) {}

  private generate(mode: AiContentMode, context: AiPropertyContext): Promise<string[]> {
    return this.gateway.generate(mode, context);
  }

  suggestTitles(context: AiPropertyContext): Promise<string[]> {
    return this.generate('title', context);
  }
}
