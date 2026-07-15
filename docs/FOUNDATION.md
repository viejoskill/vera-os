# FOUNDATION (Sprint 0A · v0.1)

VERA OS technical base: decoupled, portable and maintainable. The architecture is
independent from the environment's infrastructure.

## Logical monorepo

Implemented inside `frontend/src` with `@vera/*` aliases and strict boundaries. Promotion to
a physical monorepo (pnpm/Turborepo) = move folders + add `package.json`, **no logic rewrite**.

```
app/                 apps/vera-os (Shell, routing, screens, hooks)
packages/
  design-tokens/     TS tokens → CSS variables (single source of truth)
  ui/                VERA UI Kit: Button, Card, Input, Sidebar, TopBar
  types/             Property, User, Role, Permission
  config/            env, appConfig, featureFlags
  events/            DomainEvent + EventBus (contracts only)
  repositories/      Repository Pattern + InMemoryPropertyRepository (mock)
  services/          PropertyService, AIService + AIProvider, composition root
```

## Dependency direction (one-way)

```
app → services → repositories → types
 └→ ui → design-tokens        (config, events = leaf packages)
```

Apps never touch persistence; Services never touch the UI.

## Key patterns

- **Repository Pattern** — persistence behind interfaces; swap to Supabase/PostgreSQL without touching Apps.
- **Provider Pattern (AI)** — `AIProvider` abstracts the LLM; `MockAIProvider` today, OpenAI/Anthropic/Gemini tomorrow by changing **one line**.
- **Composition Root** — `services/service-container.ts`: the only place wiring concrete implementations.
- **Feature-flag-driven navigation** — enabling an App = flipping a flag in `@vera/config`.
- **Design Tokens** — every visual value defined once; zero hardcoded colors.

## Quality & standards

- **TypeScript strict** (`tsc --noEmit` clean), no `.js/.jsx` under `src`.
- ESLint (flat, standard), Prettier, Husky + lint-staged (active in Git/Cursor/VS Code).
- FastAPI backend with VERA structure preserved; exposes only `GET /api/health` at this stage.

## Validated vertical slice

`Properties`: UI (UI Kit) → hook → PropertyService → Repository → mock data, with filters,
search and a VERA AI briefing (mock). Tested: frontend 100%, backend 100%.

## Current constraints (by design)

No real database, no auth, no external integrations, no real AI. Everything is mock, ready
to evolve.
