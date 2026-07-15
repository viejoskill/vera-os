/** Base contract for every Domain Event in VERA. */

export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  /** Dot-namespaced event name, e.g. `property.created`. */
  readonly name: TName;
  /** ISO-8601 timestamp of when the event occurred. */
  readonly occurredAt: string;
  /** Immutable event data. */
  readonly payload: TPayload;
  /** Optional correlation id for tracing across services. */
  readonly correlationId?: string;
}
