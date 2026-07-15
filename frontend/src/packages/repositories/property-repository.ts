import type { Property } from '@vera/types';
import type { Repository } from './repository';
import { InMemoryRepository } from './in-memory-repository';
import { mockProperties } from './mock-data/properties';

/** Property persistence contract — extends the generic repository with domain queries. */
export interface PropertyRepository extends Repository<Property> {
  search(query: string): Promise<Property[]>;
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
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll();
    const all = await this.getAll();
    return all.filter((p) =>
      `${p.title} ${p.neighborhood} ${p.city} ${p.address}`.toLowerCase().includes(q),
    );
  }
}
