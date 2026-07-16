import type { Property, PropertyDetail } from '@vera/types';
import type { Repository } from './repository';

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
