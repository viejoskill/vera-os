# @vera/repositories

The **persistence boundary**. Isolates *how* data is stored from *what* the domain does.

## Purpose

Implements the **Repository Pattern**: Services talk to repository *interfaces*, never to a
database. Today the only implementation is in-memory (mock); tomorrow a Supabase/PostgreSQL
implementation drops in behind the same interface with zero changes upstream.

## Responsibilities

- `Repository<T>` — generic persistence contract.
- `InMemoryRepository<T>` — reusable mock base class.
- `PropertyRepository` + `InMemoryPropertyRepository` — property persistence.
- `mock-data/` — seed data used by the mock repositories.

## Dependencies

- `@vera/types`

## Extension points

- Add `SupabasePropertyRepository implements PropertyRepository` and swap it in the service container.
- Add new repositories (`OperationRepository`, `LeadRepository`) following the same shape.
