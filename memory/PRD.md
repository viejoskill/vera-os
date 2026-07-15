# VERA OS — Product Requirements & Architecture

## Original problem statement
VERA OS: a modern, modular, AI-first **Real Estate Operating System** (not a CRM).
UX bar: as simple as Notion, as fast as Linear, as clean as Arc. Strict architecture
(Apps show / Services think / Repositories isolate persistence / Providers abstract
integrations) and a strict official Design System that must not be modified.

## Design System (immutable tokens)
- Colors: Primary `#F6E63A`, Background `#1C1C1C`, Surface `#252525`, Cards `#2E2E2E`,
  Border `#3A3A3A`, Text `#FFFFFF`, Secondary `#B9B9B9`.
- Typography: **DM Sans**. Grid: **8px**. Single source of truth in `@vera/design-tokens`.

## Environment reality vs. spec
Spec asked for Next.js + Supabase + pnpm/Turbo monorepo. Emergent preview only serves
`/app/frontend` via craco. **User-approved decision (Option A):** a *logical monorepo*
inside `/app/frontend/src` using `@vera/*` path aliases + strict boundaries, TypeScript
`strict`. Promotion to a physical pnpm/Turbo monorepo is mechanical (folders → packages),
with **no logic rewrite**. Backend (FastAPI/Mongo) exists in the template but is NOT used
this sprint.

## Architecture (implemented)
```
src/
  app/                 apps/vera-os (Shell + routing + screens + hooks)
  packages/
    design-tokens/     single source of visual truth (TS tokens → CSS vars)
    ui/                VERA UI Kit: Button, Card, Input, Sidebar, TopBar
    types/             Property, User, Role, Permission
    config/            env, appConfig, featureFlags
    events/            DomainEvent + EventBus contracts (interfaces only)
    repositories/      Repository Pattern + InMemory(Property)Repository + mock data
    services/          PropertyService, AIService + AIProvider (Provider Pattern), container
```
Patterns: Repository Pattern, Provider Pattern (AI), Composition Root
(`services/service-container.ts`), feature-flag-driven navigation.

## User personas
Admin, Broker, Asesor Comercial, Marketing, Propietario (roles modeled in `@vera/types`;
no auth yet, by design).

## Core requirements (static)
Portable, decoupled, maintainable, scalable, performant foundation with a single functional
screen validating the full stack end-to-end. Quality tooling from day one.

## Implemented (Sprint 0A — 2026-06)
- Logical monorepo, TypeScript strict (tsc --noEmit clean), `@vera/*` aliases.
- `@vera/design-tokens` (tokens + CSS-variable injection).
- VERA UI Kit: Button, Card, Input, Sidebar, TopBar (typed, accessible, token-driven).
- Repository Pattern (in-memory mock, 6 seeded BA properties) + PropertyService.
- AIService with Provider Pattern + MockAIProvider (data-driven daily briefing).
- Events package: contracts/interfaces only (no bus yet).
- Config: env, appConfig, feature flags (drive navigation).
- Shell: Sidebar + TopBar + routing + responsive layout (mobile drawer).
- Vertical slice: `PropertiesScreen` (list, status filters, text search) — UI → hook →
  Service → Repository → mock data. Placeholder screens for feature-flagged-off apps.
- Tooling: ESLint (flat, standard), Prettier, Husky + lint-staged, `prepare` script.
- Per-package READMEs + root architecture README. Branding (title/description/font).
- Testing: iteration_1.json — frontend 100% (7/7 acceptance checks), no console/page errors.

## Implemented (Sprint 0B · Phase 1 — Property Workspace)
- `New Property Workspace` at `/propiedades/nueva`: header actions (draft/save/cancel), basic
  data form (react-hook-form + zod), features + amenities, description editor with
  "Generar con VERA", drag & drop photo area.
- Vera Studio: simulated photo pipeline (lighting → perspective → rooms → duplicates → cover).
- Vera side panel: live simulated insights (quality score, detected rooms, missing fields, recommendations).
- New services: `StudioService` (Provider Pattern + MockStudioProvider) + `VeraAssistantService`.
- UI Kit extended: Textarea, Select, Badge, Panel, Progress, Toast. Zero hardcoded colors.
- All simulated — no persistence/publishing. Tested: iteration_3.json — frontend 100% (17/17).

## Backlog (prioritized)
- **P1**: `Hoy` App (AI-first daily dashboard); Property detail screen; extract PropertyCard.
- **P1**: Real backend + `SupabasePropertyRepository` (swap behind existing interface).
- **P2**: `Operaciones` (pipeline), `Studio` (content/distribution), Insight Service.
- **P2**: Real AI provider (OpenAI/Anthropic/Gemini) via `AIProvider`; auth/RBAC; Event Bus impl.

## Notes for continuation (no chat history needed)
- Swap mocks in `src/packages/services/service-container.ts` (single wiring point).
- New App = new screen + feature-flag flip in `@vera/config` + route in `VeraOS.tsx`.
- All visual values come from `@vera/design-tokens`; never hardcode.
