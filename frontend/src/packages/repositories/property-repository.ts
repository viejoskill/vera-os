import type { Property, PropertyDetail } from '@vera/types';
import type { Repository } from './repository';
import { InMemoryRepository } from './in-memory-repository';
import { mockProperties } from './mock-data/properties';

export interface PropertyQuery {
  status?: string;
  query?: string;
}

/** Property persistence contract — extends the generic repository with domain queries. */
export interface PropertyRepository extends Repository<Property> {
  search(query: string): Promise<Property[]>;
  find(filters: PropertyQuery): Promise<Property[]>;
  getById(id: string): Promise<PropertyDetail | null>;
  archive(id: string): Promise<PropertyDetail | null>;
  restore(id: string): Promise<PropertyDetail | null>;
}

/** Mock implementation backed by in-memory seed data. */
export class InMemoryPropertyRepository
  extends InMemoryRepository<Property>
  implements PropertyRepository
{
  constructor() {
    super(mockProperties);
  }

  async search(query: string): Promise<Property[]> {
    return this.find({ query });
  }

  async find(filters: PropertyQuery): Promise<Property[]> {
    let all = await this.getAll();
    all = filters.status === 'archived' ? all.filter((p) => p.archived) : all.filter((p) => !p.archived);
    if (filters.status && filters.status !== 'all' && filters.status !== 'archived') {
      all = all.filter((p) => p.status === filters.status);
    }
    const q = filters.query?.trim().toLowerCase();
    if (q) {
      all = all.filter((p) =>
        `${p.title} ${p.neighborhood} ${p.city} ${p.address}`.toLowerCase().includes(q),
      );
    }
    return all;
  }

  async getById(id: string): Promise<PropertyDetail | null> {
    const found = await super.getById(id);
    return found ? { ...found, images: [], documents: [] } : null;
  }

  async archive(id: string): Promise<PropertyDetail | null> {
    await this.update(id, { archived: true });
    return this.getById(id);
  }

  async restore(id: string): Promise<PropertyDetail | null> {
    await this.update(id, { archived: false });
    return this.getById(id);
  }
}
