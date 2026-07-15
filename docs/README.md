# VERA OS

> **VERA is not a CRM. VERA is a Real Estate Operating System.**
> As simple as Notion, as fast as Linear, as clean as Arc.

A modern, modular, **AI-first** operating system for real estate. Users don't feel like
they're using a CRM — they feel like they're running their agency from a single place.

**Current version:** `Foundation v0.1` — Sprint 0A complete and approved.

## Principles

- **Apps show · Services think · Repositories isolate persistence · Providers abstract integrations · Design Tokens guarantee consistency.**
- Apps never talk to each other: everything goes through Services.
- VERA evolves by strengthening its Services, not by adding screens.

## Status

- **Logical monorepo** inside `frontend/src` with `@vera/*` aliases (promotion to a physical
  pnpm/Turbo monorepo is a mechanical move — no logic rewrite).
- **TypeScript strict**, a single Design System, professional tooling (ESLint, Prettier, Husky).
- One functional screen (`Properties`) validating the whole architecture end-to-end with mock data.

## Structure

```
frontend/src/
  app/                 apps/vera-os (Shell + routing + screens)
  packages/
    design-tokens/     single source of visual truth
    ui/                VERA UI Kit (Button, Card, Input, Sidebar, TopBar)
    types/ config/ events/ repositories/ services/
backend/               FastAPI (only /api/health at this stage)
docs/                  this directory
```

## Documents

- [`VISION.md`](./VISION.md) — what VERA is and where it's going.
- [`FOUNDATION.md`](./FOUNDATION.md) — architecture and technical decisions of the base.
- [`ROADMAP.md`](./ROADMAP.md) — sprints and prioritized backlog.

## Running the frontend

```bash
cd frontend
yarn start       # dev server
yarn typecheck   # tsc --noEmit (strict)
yarn lint        # eslint
```
