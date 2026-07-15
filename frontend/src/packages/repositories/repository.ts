/** Generic persistence contract. Services depend on this, never on a concrete database. */

export interface Repository<T, ID = string> {
  getAll(): Promise<T[]>;
  getById(id: ID): Promise<T | null>;
  create(entity: T): Promise<T>;
  update(id: ID, patch: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}
