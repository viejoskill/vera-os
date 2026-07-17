import { env } from '@vera/config';
import type { PropertyDetail } from '@vera/types';

export type PublicationAction = 'publish' | 'update' | 'unpublish';
export type PublicationsMap = Record<
  string,
  { status: string; lastSync?: string | null; url?: string }
>;

export interface PublicationGateway {
  setPublication(
    propertyId: string,
    channel: string,
    action: PublicationAction,
    url?: string,
  ): Promise<PublicationsMap>;
}

/**
 * Talks to the VERA backend publication endpoint. The frontend never knows how the
 * status is stored (Supabase jsonb today). Real portal integrations would live behind
 * this same gateway without changing the UI.
 */
export class ApiPublicationGateway implements PublicationGateway {
  private readonly base = `${env.backendUrl}/api/properties`;

  async setPublication(
    propertyId: string,
    channel: string,
    action: PublicationAction,
    url?: string,
  ): Promise<PublicationsMap> {
    const res = await fetch(`${this.base}/${propertyId}/publications/${channel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, url: url ?? '' }),
    });
    if (!res.ok) {
      throw new Error(`VERA publications ${res.status}`);
    }
    const detail = (await res.json()) as PropertyDetail;
    return detail.publications ?? {};
  }
}
