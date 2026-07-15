# ROADMAP

Strategy: first a **solid foundation**, then the business domain on top of it — strengthening
Services rather than adding screens.

## ✅ Sprint 0A — Foundation (v0.1, approved)

Logical monorepo, TypeScript strict, single Design System, base UI Kit, Repository + Provider
patterns, shell (Sidebar/TopBar/routing/responsive) and a Properties vertical slice (mock).

## ✅ Sprint 0A.1 — Cleanup (approved)

Removed template boilerplate (shadcn, hooks/lib/constants), project is now 100% TypeScript,
tokens consolidated (zero hardcoded colors), backend cleaned (`/api/health`).

## 🔒 Foundation v0.1

Frozen on GitHub as the stable baseline before the business domain.

## ✅ Sprint 0B · Phase 1 — Property Workspace (done)

`New Property Workspace` at `/propiedades/nueva`: header actions (draft/save/cancel), basic
data form (react-hook-form + zod), features + amenities, description editor with "Generar con
VERA", and a big drag & drop photo area. **Vera Studio** simulates background processing
(lighting → perspective → rooms → duplicates → cover). **Vera side panel** shows live
simulated insights (quality score, detected rooms, missing fields, recommendations). New
services: `StudioService` (Provider Pattern) + `VeraAssistantService`. UI Kit extended
(Textarea, Select, Badge, Panel, Progress, Toast). All simulated — no persistence. Tested 17/17.

## ✅ Sprint 2.3 — Property Workspace complete

`New Property Workspace` organized into 6 blocks: Información, Propietario, Fotografías,
Vera Studio, Publicación, Health Score. Discreet top progress bar (% completado, no wizard).
Health Score reimagined as a **diagnosis** (number + label + calm message + "Siguiente paso
recomendado"). Publicación shows readiness status + automatic checklist. Product principle
applied throughout: **never show "empty fields" — show "next actions"**. New: `OwnerService`
(mock, ready for multiple owners) + `assistantService.assess()`. Tested 21/21.

## ▶️ Next phases

- **Persist** the new property (real backend + `SupabasePropertyRepository`).
- **Property detail** screen + edit workspace reuse.

## Prioritized backlog

**P1**
- Real backend + Supabase/PostgreSQL repositories (swap behind interfaces).
- `Operations` App (sales pipeline) + `OperationService` + `InsightService`.

**P2**
- `Studio` App (content & distribution: Mercado Libre, Meta, Google, WhatsApp).
- Real AIProvider (OpenAI/Anthropic/Gemini) via the Provider Pattern.
- Auth + RBAC (roles already modeled in `@vera/types`).
- `EventBus` implementation (contracts already defined in `@vera/events`).

**Future**
- Portals (Owner/Buyer/Investor), automations, appraisals, lead scoring, analytics, documents
  and digital signatures — without rewriting the architecture.
