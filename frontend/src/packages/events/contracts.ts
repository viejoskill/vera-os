/**
 * Domain Event contracts. These are the typed messages Services will emit/consume.
 * Definitions only — publishing is wired in a future sprint.
 */
import type { DomainEvent } from './domain-event';

export type PropertyCreatedEvent = DomainEvent<
  'property.created',
  { propertyId: string }
>;

export type PropertyStatusChangedEvent = DomainEvent<
  'property.status_changed',
  { propertyId: string; from: string; to: string }
>;

export type OperationStageChangedEvent = DomainEvent<
  'operation.stage_changed',
  { operationId: string; from: string; to: string }
>;

/** Union of all known events — extend as the domain grows. */
export type VeraDomainEvent =
  | PropertyCreatedEvent
  | PropertyStatusChangedEvent
  | OperationStageChangedEvent;
