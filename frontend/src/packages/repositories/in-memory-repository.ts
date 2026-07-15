/**
 * In-memory implementation of {@link Repository}. Used for mock/dev data.
 * Swapping to Supabase/PostgreSQL = a new class implementing the same interface.
 */
import type { Repository } from './repository';

export abstract class InMemoryRepository<T extends { id: string }>
  implements Repository<T>
{
  protected items: T[];

  constructor(seed: readonly T[] = []) {
    this.items = [...seed];
  }

  async getAll(): Promise<T[]> {
    return [...this.items];
  }

  async getById(id: string): Promise<T | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async create(entity: T): Promise<T> {
    this.items = [entity, ...this.items];
    return entity;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const updated = { ...this.items[index], ...patch };
    this.items[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length < before;
  }
}
