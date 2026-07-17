import { env } from '@vera/config';

/** Attributes VERA can use to generate content. Only known facts — never invented. */
export interface AiPropertyContext {
  type?: string;
  operation?: string;
  city?: string;
  neighborhood?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | null;
  yearBuilt?: string;
  amenities?: string[];
  nearSea?: boolean;
}

export type AiContentMode = 'title' | 'description' | 'highlights';

export interface AiContentGateway {
  generate(mode: AiContentMode, context: AiPropertyContext): Promise<string[]>;
}

/**
 * Talks to the VERA backend AI endpoint. The frontend never knows which LLM runs
 * behind it — swapping the model/provider changes only the backend.
 */
export class ApiAiContentGateway implements AiContentGateway {
  private readonly url = `${env.backendUrl}/api/ai/content`;

  async generate(mode: AiContentMode, context: AiPropertyContext): Promise<string[]> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ...context }),
    });
    if (!res.ok) {
      throw new Error(`VERA AI ${res.status}`);
    }
    const data = (await res.json()) as { suggestions?: string[] };
    return data.suggestions ?? [];
  }
}
