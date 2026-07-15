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

## ▶️ Sprint 0B — Business domain (next)

Build VERA's domain on top of the stable base. Candidates:

- **Today App** — AI-first dashboard with the daily briefing and quick actions.
- **Property detail** — full record + gallery (extract `PropertyCard`).
- **Real persistence** — `SupabasePropertyRepository` behind the existing interface.
- Extend the UI Kit as needed (Modal, Badge, Tabs, Panel, Timeline, FAB).

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
