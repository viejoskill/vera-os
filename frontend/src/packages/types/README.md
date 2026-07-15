# @vera/types

Shared, framework-agnostic **domain contracts** for the whole platform.

## Purpose

A single home for the interfaces and type unions used across Apps, Services and
Repositories, so no type is duplicated.

## Responsibilities

- Domain entities: `Property` (and its unions `PropertyStatus`, `PropertyType`, ...).
- Identity model: `User`, `Role`, `Permission` (architecture only — no auth yet).

## Dependencies

None.

## Extension points

- Add `Operation`, `Lead`, `Contract`, `Owner`, `Buyer` entities here as new Apps arrive.
- Extend `Role` / `Permission` when RBAC is implemented.
