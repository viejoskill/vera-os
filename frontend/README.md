# VERA OS — Frontend

> **VERA is not a CRM. VERA is a Real Estate Operating System.**
> Apps show · Services think · Repositories isolate persistence · Providers abstract integrations · Design Tokens guarantee consistency.

## Architecture (Sprint 0A)

A **logical monorepo** implemented with path aliases (`@vera/*`) and strict package
boundaries. Promotion to a physical pnpm/Turborepo monorepo is a mechanical move (each
folder becomes a package with its own `package.json`) — **no logic is rewritten**.

```
src/
  app/                     # apps/vera-os  — the runnable application (Shell + screens)
  packages/
    design-tokens/         # @vera/design-tokens  — single source of visual truth
    ui/                    # @vera/ui             — VERA UI Kit (Button, Card, Input, Sidebar, TopBar)
    types/                 # @vera/types          — shared domain contracts (Property, User, Role)
    config/                # @vera/config         — env, app config, feature flags
    events/                # @vera/events         — domain event contracts (interfaces only)
    repositories/          # @vera/repositories   — Repository Pattern (in-memory mock)
    services/              # @vera/services       — business logic (PropertyService, AIService + Provider Pattern)
```

### Dependency direction (strict, one-way)

```
app  →  services  →  repositories  →  types
 │         │                          ▲
 │         └────────→ (AI Provider)   │
 └──→ ui  →  design-tokens ───────────┘
            config, events  (leaf packages)
```

Apps never import Repositories or a database directly. Services never touch the UI.

## Key patterns

- **Repository Pattern** — persistence hidden behind interfaces (`@vera/repositories`).
- **Provider Pattern** — `AIProvider` abstracts the LLM vendor; `MockAIProvider` today,
  OpenAI/Anthropic/Gemini later, by changing **one line** in the service composition root.
- **Composition Root** — `services/service-container.ts` is the only place wiring concrete
  implementations (mocks vs. real).
- **Design Tokens** — every visual value defined once in TypeScript, projected to CSS vars.

## Vertical slice

`PropertiesScreen` proves the whole chain end-to-end:
`UI (VERA Kit) → hook → PropertyService → PropertyRepository → mock data`,
plus `AIService → MockAIProvider` for the daily briefing.

## Scripts

```bash
yarn start       # dev server (craco)
yarn build       # production build
yarn typecheck   # tsc --noEmit (strict)
yarn lint        # eslint (flat config)
yarn format      # prettier
```

## Quality tooling

TypeScript (`strict: true`), ESLint (flat, standard rules), Prettier, Husky + lint-staged.
Husky activates automatically once the project lives in a Git repo (Cursor / VS Code).

## Portability

No proprietary runtime dependencies. Aliases, tokens and patterns are standard and
portable to any IDE or a physical monorepo.
