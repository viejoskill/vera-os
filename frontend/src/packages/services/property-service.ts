import type { Property, PropertyDetail, PropertyStatus } from '@vera/types';
import type { PropertyRepository } from '@vera/repositories';

export interface PropertyFilters {
  status?: PropertyStatus | 'all' | 'archived';
  query?: string;
}

/**
 * PropertyService — owns all business logic about the property portfolio.
 * Depends on a {@link PropertyRepository} abstraction, never on a database.
 */
export class PropertyService {
  constructor(private readonly repository: PropertyRepository) {}

  getProperties(filters: PropertyFilters = {}): Promise<Property[]> {
    return this.repository.find({ status: filters.status, query: filters.query });
  }

  getProperty(id: string): Promise<PropertyDetail | null> {
    return this.repository.getById(id);
  }

  updateProperty(id: string, patch: Partial<Property>): Promise<PropertyDetail | null> {
    return this.repository.update(id, patch) as Promise<PropertyDetail | null>;
  }

  archive(id: string): Promise<PropertyDetail | null> {
    return this.repository.archive(id);
  }

  restore(id: string): Promise<PropertyDetail | null> {
    return this.repository.restore(id);
  }

  duplicate(id: string): Promise<PropertyDetail | null> {
    return this.repository.duplicate(id);
  }

  /** Portfolio value of currently active (non-archived) listings. */
  async getPortfolioValue(): Promise<number> {
    const items = await this.repository.find({ status: 'active' });
    return items.reduce((sum, p) => sum + p.price, 0);
  }
}
