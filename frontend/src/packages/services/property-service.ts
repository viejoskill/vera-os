import type { Property, PropertyStatus } from '@vera/types';
import type { PropertyRepository } from '@vera/repositories';

export interface PropertyFilters {
  status?: PropertyStatus | 'all';
  query?: string;
}

/**
 * PropertyService — owns all business logic about the property portfolio.
 * Depends on a {@link PropertyRepository} abstraction, never on a database.
 */
export class PropertyService {
  constructor(private readonly repository: PropertyRepository) {}

  async getProperties(filters: PropertyFilters = {}): Promise<Property[]> {
    let items = filters.query
      ? await this.repository.search(filters.query)
      : await this.repository.getAll();

    if (filters.status && filters.status !== 'all') {
      items = items.filter((p) => p.status === filters.status);
    }
    return items;
  }

  getProperty(id: string): Promise<Property | null> {
    return this.repository.getById(id);
  }

  /** Portfolio value of currently active listings (business rule lives in the Service). */
  async getPortfolioValue(): Promise<number> {
    const items = await this.repository.getAll();
    return items
      .filter((p) => p.status === 'active')
      .reduce((sum, p) => sum + p.price, 0);
  }
}
