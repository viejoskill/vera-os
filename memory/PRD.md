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

## Implemented (Sprint "Validación / calidad de uso" — App Propiedades — 2026-06)
Etapa de validación (usar VERA a diario, sin funciones nuevas). Pulido de la App "Propiedades" verificado 100% (11/11) por testing agent (iteration_12), sin regresiones.
- Búsqueda **instantánea client-side** (fetch por status cacheado; el texto filtra en memoria, sin parpadeo).
- **Empty state con CTA** ("Cargá mi primera propiedad"); variantes para búsqueda vacía / archivadas / sin datos.
- Cards: se ocultan specs en 0, ubicación sin coma huérfana (`filter(Boolean).join`), contenedor de specs no renderiza si no hay ninguno > 0.
- Alta más clara: placeholders marcados como ejemplo ("Ej.: …"); Health Score con estado inicial **"Empecemos"** (sin "0" frío).
- **Ruido demo/mock removido**: banner "VERA AI · demo" eliminado; "Vera Studio" simulado **oculto** (flag `SHOW_VERA_STUDIO=false`, código intacto); botón "Guardar borrador" **eliminado** (no persistía).
- **Detalles premium**: confirmación de guardado sutil (píldora "Guardado" que se desvanece, sin toast); transición suave de recomendaciones en "Hoy" (`vera-rec-in`); fotos con aparición sin saltos (`vera-fade-in`); todo con guard `prefers-reduced-motion`.
- Fuente de verdad para evolucionar: **`/app/memory/BACKLOG_USO.md`** (mejoras de uso / funcionalidades futuras / bugs) + regla de la etapa: mejoras <30 min y claras se resuelven al toque; lo que toca arquitectura o funcionalidad nueva pasa al backlog y se decide en conjunto.

## Implemented (Sprint "Acceso y Autenticación" — VERA Pilot v0.3 — 2026-06)
Login premium + Supabase Auth. Verificado e2e por el agente (login→Hoy, persistencia al recargar, logout, protección de rutas, credenciales inválidas). Alcance acotado: solo acceso (sin registro, recuperar contraseña, invitaciones ni roles).
- **Supabase Auth** (email+password) con **Publishable Key** en el frontend (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`). La service_role sigue solo en backend. Sin usuarios/credenciales hardcodeados; el usuario se crea desde el Dashboard.
- `src/app/auth/`: `supabase-client.ts` (client + `hasStoredSession()` para arranque optimista), `AuthProvider.tsx` (context: session/ready/bootAuthed/signOut), `RequireAuth.tsx` (guard con preservación de intención vía `state.from`).
- `LoginScreen.tsx`: pantalla premium con sistema de diseño VERA (glow sereno, DM Sans, #F6E63A), botón **"Ingresar a VERA"**, mensajes sin la palabra "Error".
- Router (`VeraOS.tsx`): `/login` público; resto bajo `RequireAuth`. Sin sesión → `/login`; con sesión → `/hoy`. Sesión persistente (localStorage) — el usuario no vuelve a ver el Login. Sesión expirada → redirige a Login conservando la ruta.
- **Logout** en menú desplegable del avatar (arriba a la derecha, `UserMenu.tsx` en el TopBar).
- **Carga instantánea sin flash**: arranque optimista (si hay token en storage renderiza la app directo; si no, no muestra spinner). Env vars con referencias estáticas para que CRA las inline correctamente.
- Pendiente registrado en BACKLOG_USO: endurecer la API del backend con verificación de JWT.

## Implemented (Sprint "Pulido final para el Piloto" — VERA Pilot v0.3 — 2026-06)
Pulido de calidad percibida (sin features nuevas ni cambios de arquitectura). Verificado 10/10 por testing agent (iteration_13), sin bugs.
- **Apps "Próximamente"**: Operaciones/Studio deshabilitadas en el menú (badge "Próximamente", sin navegación). Por URL directa → `PlaceholderScreen` cuidada (ícono + "{App} está en camino." + botón "Volver a Inicio").
- **Idioma 100% español**: se eliminó "Real Estate Operating System" en toda la app. Tagline → "Sistema Operativo Comercial" (TopBar + pie del Login).
- **"Propiedad no encontrada"** cuidada: mensaje humano + botón "Volver a Propiedades".
- **Workspace**: se quitó el botón "Volver" superior (queda solo la flecha ← + "Guardar"). Subtítulo sin el término técnico "Workspace" → "Toda la información de la propiedad, en un solo lugar."
- **Checklist único**: la lista de "qué falta" vive solo en la tarjeta Health Score; "Publicación" quedó como Estado + resumen. Casing unificado ("Lista para publicar").
- **Limpieza de mocks**: eliminados `useDailyBriefing`, `AIService`/`MockAIProvider` (briefing mock), `InMemoryPropertyRepository` + `mock-data/properties.ts`, flag `veraAi`, y backend `services/studio_service.py` (import roto, sin uso).
- **Regla de producto documentada**: el usuario nunca ve cómo está construido VERA (Workspace/Provider/Repository/AI Engine son conceptos internos). "Health Score" queda a evaluar más adelante.
- Docs: `/app/docs/PILOT.md` (objetivo/reglas/inicio del piloto: Julio 2026).

### Estado: LISTO PARA DEPLOY (Pilot). Chequeo de deployment: sin bloqueantes.

## Backlog (prioritized)
- **P1**: `Hoy` App (AI-first daily dashboard); Property detail screen; extract PropertyCard.

## Implemented (Sprint "Construir para usar" — VIE catálogo de reglas — 2026-06)
Foco: convertir VERA en producto usable a diario. La App "Hoy" corre sobre un **catálogo de reglas explícito y determinista** del VERA Intelligence Engine, alimentado 100% por datos reales de propiedades (sin mocks, sin KPIs/gráficos/widgets). Verificado 100% por testing agent (iteration_11): backend 9/9 pytest, frontend todas las aceptaciones.

- **Catálogo de reglas** (`packages/services/intelligence/property-rules.ts`): reglas puras y ordenadas por urgencia — `datos-incompletos`, `sin-precio`, `sin-fotos` (🔴 alta); `pocas-fotos`, `sin-descripcion`, `sin-propietario`, `sin-actividad` (🟡 atención); `sin-plano`, `sin-video`, `lista-para-publicar` (🟢 oportunidad). `evaluateProperty()` devuelve la ÚNICA acción más importante por propiedad (siguiente mejor paso). Cambio de comportamiento vs iteration_10: una propiedad lista sin video muestra "Sumá un video"; solo muestra "Publicá la propiedad" con plano + video presentes.
- **Estado derivado real**: cada recomendación responde Qué pasó / Por qué importa / Qué recomienda VERA + "Resolver ahora"; desaparece automáticamente al resolverse (sin botón "marcar como resuelto"). `['today']` se invalida desde el Workspace (guardar/archivar/restaurar); default refetch-on-mount cubre las subidas de media.
- **Actividad real** (`updatedAt`): backend expone `updated_at`; `property_repository.touch()` lo actualiza en cada actividad de media (subir/borrar imagen y documento, portada, reorder) y en update/archive/restore. Habilita la regla `sin-actividad` (idle > 21 días).
- Decisión de producto: NO existe una card "Health Score bajo" separada — el health es el *síntoma*; VERA surface la *causa* (ítem faltante concreto), fiel a "mostrar próximas acciones, no campos vacíos".
- Tests backend: `/app/backend/tests/test_updated_at_touch.py` (9 casos).

## Backlog restante (prioritized)
- **P1**: Real backend + `SupabasePropertyRepository` (swap behind existing interface).
- **P2**: `Operaciones` (pipeline), `Studio` (content/distribution), Insight Service.
- **P2**: Real AI provider (OpenAI/Anthropic/Gemini) via `AIProvider`; auth/RBAC; Event Bus impl.

## Notes for continuation (no chat history needed)
- Swap mocks in `src/packages/services/service-container.ts` (single wiring point).
- New App = new screen + feature-flag flip in `@vera/config` + route in `VeraOS.tsx`.
- All visual values come from `@vera/design-tokens`; never hardcode.
