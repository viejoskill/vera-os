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

## Implemented (Sprint 2.3 — Property Workspace complete)
- Workspace reorganized into 6 blocks: Información, Propietario, Fotografías, Vera Studio, Publicación, Health Score.
- Discreet top progress bar (% completado, not a wizard). Calm, non-technical microcopy.
- Health Score as a diagnosis (number + label + message + "Siguiente paso recomendado").
- Publicación: readiness status ("Lista para Publicar" / "En preparación") + automatic checklist (core + optional).
- Product principle applied: never show "empty fields" — show "next actions".
- New `OwnerService` (mock, list API ready for multiple owners) + `assistantService.assess()` (completion/health/checklist/nextStep).
- Manual cover + drag-reorder preserved; cover choice always wins over AI suggestion.
- Tested: iteration_6.json — frontend 100% (21/21). Zero console errors.

## Implemented (Sprint 2.4 — Workspace refinements)
- Cover rule made consistent: drag & drop (and ↑/↓ buttons) only REORDER; cover is set ONLY by clicking a photo ("VERA sugiere, el usuario decide"). No drag-to-cover.
- Real property fields added: Año de construcción, Video (link), Plano (link). Publicación checklist + Health Score derive from them (no hardcoded states).
- Mobile reorder: ↑ Subir / ↓ Bajar buttons on each photo (disabled at ends, stopPropagation so they never change cover); desktop keeps drag & drop.
- Health Score now shows "¿Qué falta para llegar a Excelente?" with the full 8-item checklist + next step; celebratory state at 100.
- Publicación focuses on the 5 core publish requirements + summary line.
- Tested: iteration_7.json — frontend 100% (21/21). Zero console errors.

## Implemented (Sprint "Documentos" — 2026-06)
- Nuevo módulo **Documentos** cableado en el Workspace (Panel propio bajo Fotografías), reemplaza el input suelto "Plano (link)".
- `DocumentsSection` + `useDocuments` (estado cliente, un doc por tipo, `URL.createObjectURL` con cleanup). Tipo `plano` hoy; lista `DOCUMENT_SLOTS` preparada para crecer (escritura, reglamento, etc.).
- Acepta PDF/JPG/PNG. Subir muestra chip con nombre + botón quitar.
- `assistantService.assess()` ahora recibe `documentTypes` y deriva el ítem `plano` del módulo (no del form). Health Score y Publicación consumen el checklist genérico sin cambios de contrato.
- Removido `floorPlanUrl` de `form-schema` y `FeaturesSection` (grid Multimedia queda en 2 columnas: Año + Video).
- Filosofía respetada: "Producto primero, infraestructura después" — todo funcional a nivel UX, mock en memoria, listo para respaldar con Storage/`SupabasePropertyRepository` sin tocar UI.
- Estilos `.vera-doc*` agregados a index.css con tokens (cero colores hardcodeados). `tsc --noEmit` limpio. Verificado con screenshot tool (upload→checklist done→remove).

## Implemented (Sprint "Persistencia + Storage" — 2026-06)
Cerrado el flujo completo de una propiedad **end-to-end contra Supabase real** (verificado 11/11 por testing agent, 0 errores de consola).

**Backend (FastAPI)** — nueva capa de datos y archivos, detrás de abstracciones:
- Datos vía **Supabase PostgREST** (cliente `supabase`), NO conexión directa a Postgres. `SupabasePropertyRepository` (repositorio) + `supabase_client.py` (único módulo que toca el SDK).
- **StorageService** abstracto + `SupabaseStorageService`: buckets **privados** `property-images` / `property-documents`, **Signed URLs** generadas por el backend, nombres con **UUID** + metadata en DB, rutas jerárquicas `workspaces/{workspace_id}/properties/{property_id}/images|documents/`. Migrar a S3/R2 = cambiar solo esta clase.
- Rutas: CRUD `/api/properties`; subida/borrado de imágenes y documentos; `PATCH .../images/{id}/cover`; borrado de propiedad limpia también los objetos de storage (sin huérfanos).
- Tablas creadas por SQL en Supabase (`/app/backend/supabase_schema.sql`): `properties`, `property_images`, `property_documents`.
- App arranca aunque falten credenciales (product-first); health expone `supabase_configured`.
- Credenciales en `/app/backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (solo backend), buckets, TTL, `DEFAULT_WORKSPACE_ID`.

**Frontend (React)** — el frontend NUNCA conoce Supabase:
- `ApiPropertyRepository` (implementa `PropertyRepository`) + `ApiPropertyFilesGateway` (subidas multipart). Wiring cambiado en `service-container.ts` (mock → API).
- `WorkspaceService.save({values, photos, documents})`: crea la propiedad, sube fotos en orden, respeta la portada elegida por el usuario, sube documentos.
- Workspace "Guardar" ahora **persiste de verdad** (antes era simulado): construye payload tipado, sube assets, invalida query `['properties']`, redirige. Estado "Guardando…".
- `PropertiesScreen` lee del backend real; card con fallback cuando no hay portada u ocurre error de Signed URL.

**Nota de arquitectura:** se pivoteó de SQLAlchemy/Alembic a PostgREST porque no se pudo obtener el password del Transaction Pooler; todo queda dentro de Supabase y detrás de la misma interfaz. Si más adelante se quiere SQLAlchemy directo, solo cambia el repo del backend.

## Implemented (Sprint "Workspace unificado" — 2026-06)
El **Workspace de Propiedad** es ahora un único componente reutilizable (pilar de VERA OS). Verificado 24/24 por testing agent + self-test.

- **Un solo Workspace**: `/propiedades/nueva` (vacío) y `/propiedades/:id` (cargado). Se eliminaron los conceptos de pantallas "Detalle/Editar" separadas. Clic en card → abre su Workspace. Reglas permanentes documentadas en `/app/docs/WORKSPACE.md`.
- **Persistencia en vivo** (propiedad existente): subir/eliminar/reordenar fotos, cambiar portada, subir/eliminar documentos impactan al instante en Supabase — atómicas, con rollback automático y feedback sutil (`Guardando…`/`Guardado`/`Error`). Datos de negocio con "Guardar".
- **Orden de galería persistido**: `PATCH /api/properties/{id}/images/reorder` (campo `position`). Portada y orden son independientes (regla C).
- **Ciclo de vida**: sección "Ciclo de vida" en el Workspace con Archivar/Restaurar. Archivar = estado `archived` recuperable (conserva todo); Eliminar NO se expone en la UI (admin + doble confirmación, futuro). Filtro "Archivadas" en la lista. Menú "…" en la card (Abrir / Duplicar deshabilitado "Próximamente" / Archivar-Restaurar).
- **Propietario persistido** (`owner_id`, `owner_observations`) para que el Health Score sea consistente al reabrir.
- Backend: endpoints archive/restore/reorder + filtro archivadas; hooks `useProperty`, `useWorkspaceGallery`, `useWorkspaceDocuments`; repos `find/archive/restore`, gateway `reorder/deleteImage/deleteDocument`.

## Backlog (prioritized)
- **P1**: `Hoy` App (AI-first daily dashboard); Property detail screen; extract PropertyCard.
- **P1**: Real backend + `SupabasePropertyRepository` (swap behind existing interface).
- **P2**: `Operaciones` (pipeline), `Studio` (content/distribution), Insight Service.
- **P2**: Real AI provider (OpenAI/Anthropic/Gemini) via `AIProvider`; auth/RBAC; Event Bus impl.

## Notes for continuation (no chat history needed)
- Swap mocks in `src/packages/services/service-container.ts` (single wiring point).
- New App = new screen + feature-flag flip in `@vera/config` + route in `VeraOS.tsx`.
- All visual values come from `@vera/design-tokens`; never hardcode.
