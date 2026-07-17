import { env } from '@vera/config';

/** Attributes VERA can use to generate content. Only known facts — never invented. */
export interface AiPropertyContext {
  type?: string;
  operation?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  title?: string;
  description?: string;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  toilettes?: number | null;
  areaM2?: number | null;
  semiCoveredAreaM2?: number | null;
  lotAreaM2?: number | null;
  floors?: number | null;
  floorNumber?: number | null;
  parkingCovered?: number | null;
  parkingUncovered?: number | null;
  orientation?: string;
  condition?: string;
  yearBuilt?: string;
  amenities?: string[];
  nearSea?: boolean;
}

export type AiContentMode = 'title' | 'description' | 'highlights' | 'portal';
export type PortalId = 'mercadolibre' | 'zonaprop';

export interface AiContentResult {
  suggestions: string[];
  title: string;
  body: string;
}

export interface PortalText {
  title: string;
  body: string;
}

export interface ExpressResult {
  titles: string[];
  description: string;
  highlights: string[];
  mercadolibre: PortalText;
  zonaprop: PortalText;
}

export interface AiContentGateway {
  generate(
    mode: AiContentMode,
    context: AiPropertyContext,
    portal?: PortalId,
  ): Promise<AiContentResult>;
  generateExpress(context: AiPropertyContext): Promise<ExpressResult>;
}

/**
 * Talks to the VERA backend AI endpoint. The frontend never knows which LLM runs
 * behind it — swapping the model/provider changes only the backend.
 */
export class ApiAiContentGateway implements AiContentGateway {
  private readonly url = `${env.backendUrl}/api/ai/content`;

  async generate(
    mode: AiContentMode,
    context: AiPropertyContext,
    portal?: PortalId,
  ): Promise<AiContentResult> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, portal: portal ?? '', ...context }),
    });
    if (!res.ok) {
      throw new Error(`VERA AI ${res.status}`);
    }
    const data = (await res.json()) as Partial<AiContentResult>;
    return {
      suggestions: data.suggestions ?? [],
      title: data.title ?? '',
      body: data.body ?? '',
    };
  }

  async generateExpress(context: AiPropertyContext): Promise<ExpressResult> {
    const res = await fetch(`${env.backendUrl}/api/ai/express`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...context }),
    });
    if (!res.ok) {
      throw new Error(`VERA AI express ${res.status}`);
    }
    const data = (await res.json()) as Partial<ExpressResult>;
    const empty = { title: '', body: '' };
    return {
      titles: data.titles ?? [],
      description: data.description ?? '',
      highlights: data.highlights ?? [],
      mercadolibre: data.mercadolibre ?? empty,
      zonaprop: data.zonaprop ?? empty,
    };
  }
}
