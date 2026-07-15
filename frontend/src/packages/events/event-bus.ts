/**
 * EventBus contract. INTERFACE ONLY — no implementation ships in Sprint 0A.
 * A concrete bus (in-memory, or backed by Supabase Realtime / a queue) will be
 * injected later without touching publishers or subscribers.
 */
import type { DomainEvent } from './domain-event';

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
) => void | Promise<void>;

export type Unsubscribe = () => void;

export interface EventBus {
  publish<T extends DomainEvent>(event: T): void | Promise<void>;
  subscribe<T extends DomainEvent>(name: T['name'], handler: EventHandler<T>): Unsubscribe;
}
