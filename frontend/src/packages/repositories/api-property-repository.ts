import type { Property } from '@vera/types';
import { env } from '@vera/config';
import type { PropertyRepository } from './property-repository';

/**
 * Talks to the VERA backend (FastAPI) over HTTP. The frontend never knows about
 * Supabase — persistence and storage are the backend's concern. Swapping backends
 * later means changing only this class, not the Services or UI.
 */
export class ApiPropertyRepository implements PropertyRepository {
  private readonly base = `${env.backendUrl}/api/properties`;

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) {
      throw new Error(`VERA API ${res.status}: ${await res.text()}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async getAll(): Promise<Property[]> {
    return this.request<Property[]>('');
  }

  async getById(id: string): Promise<Property | null> {
    try {
      return await this.request<Property>(`/${id}`);
    } catch {
      return null;
    }
  }

  async create(entity: Property): Promise<Property> {
    return this.request<Property>('', {
      method: 'POST',
      body: JSON.stringify(entity),
    });
  }

  async update(id: string, patch: Partial<Property>): Promise<Property | null> {
    try {
      return await this.request<Property>(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.request<void>(`/${id}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string): Promise<Property[]> {
    const q = encodeURIComponent(query.trim());
    return this.request<Property[]>(`?query=${q}`);
  }
}
