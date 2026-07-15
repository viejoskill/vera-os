# @vera/events

The **contracts** for VERA's event-driven backbone.

## Purpose

Define the shape of Domain Events and the `EventBus` interface so Services can stay
decoupled (a Service emits an event; it never calls another Service directly).

## Responsibilities

- `DomainEvent` — base event contract.
- `EventBus` — publish/subscribe **interface** (no implementation yet, by design).
- `contracts.ts` — typed event definitions (`property.created`, ...).

## Dependencies

None.

## Status

**Interfaces only.** No Event Bus is implemented in Sprint 0A — this package fixes the
contracts so a concrete bus (in-memory, Supabase Realtime, queue) can be added later
without changing publishers or subscribers.

## Extension points

- Implement `EventBus` (e.g. `InMemoryEventBus`) and inject it via the service container.
- Add new event contracts to `contracts.ts` and to the `VeraDomainEvent` union.
