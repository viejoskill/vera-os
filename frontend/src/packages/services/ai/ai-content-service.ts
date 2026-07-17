import type {
  AiContentGateway,
  AiContentMode,
  AiPropertyContext,
  PortalId,
} from '@vera/repositories';

/**
 * AiContentService — orchestrates VERA's content suggestions. Business rule:
 * VERA PROPONE, el profesional decide — this service only returns suggestions,
 * it never mutates the property. Reusable across modes through the same gateway.
 */
export class AiContentService {
  constructor(private readonly gateway: AiContentGateway) {}

  private generate(mode: AiContentMode, context: AiPropertyContext, portal?: PortalId) {
    return this.gateway.generate(mode, context, portal);
  }

  async suggestTitles(context: AiPropertyContext): Promise<string[]> {
    return (await this.generate('title', context)).suggestions;
  }

  async suggestDescription(context: AiPropertyContext): Promise<string> {
    return (await this.generate('description', context)).suggestions[0] ?? '';
  }

  async suggestHighlights(context: AiPropertyContext): Promise<string[]> {
    return (await this.generate('highlights', context)).suggestions;
  }

  async adaptForPortal(
    context: AiPropertyContext,
    portal: PortalId,
  ): Promise<{ title: string; body: string }> {
    const r = await this.generate('portal', context, portal);
    return { title: r.title, body: r.body };
  }
}
