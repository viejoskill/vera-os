import type { Property, PropertyDetail } from '@vera/types';
import { env } from '@vera/config';
import type { PropertyQuery, PropertyRepository } from './property-repository';

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

  async find(filters: PropertyQuery): Promise<Property[]> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.query?.trim()) params.set('query', filters.query.trim());
    const qs = params.toString();
    return this.request<Property[]>(qs ? `?${qs}` : '');
  }

  async getById(id: string): Promise<PropertyDetail | null> {
    try {
      return await this.request<PropertyDetail>(`/${id}`);
    } catch {
      return null;
    }
  }

  async create(entity: Property): Promise<PropertyDetail> {
    return this.request<PropertyDetail>('', {
      method: 'POST',
      body: JSON.stringify(entity),
    });
  }

  async update(id: string, patch: Partial<Property>): Promise<PropertyDetail | null> {
    try {
      return await this.request<PropertyDetail>(`/${id}`, {
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
    return this.find({ query });
  }

  async archive(id: string): Promise<PropertyDetail | null> {
    return this.request<PropertyDetail>(`/${id}/archive`, { method: 'PATCH' });
  }

  async restore(id: string): Promise<PropertyDetail | null> {
    return this.request<PropertyDetail>(`/${id}/restore`, { method: 'PATCH' });
  }
}
