import type { PropertyDetail, InboxRecommendation, DocumentType } from '@vera/types';
import type { PropertyService } from '../property-service';
import type { VeraAssistantService, AssistantFormValues } from '../assistant/assistant-service';
import type { IntelligenceProvider } from './intelligence-provider';
import { evaluateProperty } from './property-rules';

const daysSince = (iso?: string): number => {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
};

const toValues = (d: PropertyDetail): AssistantFormValues => ({
  title: d.title,
  type: d.type,
  operation: d.operation,
  price: d.price ? String(d.price) : '',
  neighborhood: d.neighborhood,
  bedrooms: d.bedrooms ? String(d.bedrooms) : '',
  bathrooms: d.bathrooms ? String(d.bathrooms) : '',
  areaM2: d.areaM2 ? String(d.areaM2) : '',
  description: d.description,
  ownerId: d.ownerId ?? '',
  yearBuilt: d.yearBuilt ?? '',
  videoUrl: d.videoUrl ?? '',
});

/**
 * PropertiesProvider — turns real property state into next-best-step recommendations
 * using the VERA Intelligence Engine rule catalog. One recommendation per property
 * (the single most impactful active rule), so the Inbox stays focused on "what to do
 * first". Recommendations are derived state: they vanish when the condition is resolved.
 */
export class PropertiesProvider implements IntelligenceProvider {
  readonly id = 'properties';

  constructor(
    private readonly properties: PropertyService,
    private readonly assistant: VeraAssistantService,
  ) {}

  async generate(): Promise<InboxRecommendation[]> {
    const list = await this.properties.getProperties({ status: 'all' });
    const details = await Promise.all(list.map((p) => this.properties.getProperty(p.id)));
    return details
      .map((d) => (d ? this.evaluate(d) : null))
      .filter((r): r is InboxRecommendation => r !== null);
  }

  private evaluate(d: PropertyDetail): InboxRecommendation | null {
    const assessment = this.assistant.assess({
      values: toValues(d),
      photoCount: d.images.length,
      documentTypes: d.documents.map((doc) => doc.docType) as DocumentType[],
    });

    const outcome = evaluateProperty({
      detail: d,
      assessment,
      photoCount: d.images.length,
      idleDays: daysSince(d.updatedAt || d.createdAt),
    });
    if (!outcome) return null;

    const subject = d.neighborhood ? `${d.title} · ${d.neighborhood}` : d.title || 'Propiedad';

    return {
      id: `property-${d.id}`,
      priority: outcome.priority,
      subject,
      title: outcome.title,
      whatHappened: outcome.whatHappened,
      whyItMatters: outcome.whyItMatters,
      recommendation: outcome.recommendation,
      impact: outcome.impact,
      target: {
        entity: 'property',
        entityId: d.id,
        section: outcome.section,
        focus: outcome.focus,
      },
    };
  }
}
