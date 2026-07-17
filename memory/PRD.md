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

## Implemented (Sprint "Cerrar App Propiedades" — cierre funcional — 2026-06)
Todo dentro del Workspace (sin apps/módulos/navegación nueva). Verificado 100% por testing agent (iteration_14): backend 7/7 pytest, frontend 9/9. Sin bugs. Datos reales intactos.
- **Card**: código interno derivado del id (`VAR-XXXXXX`, sin columna en DB) + línea de ubicación con la dirección como identificador principal (`Dirección · Ciudad · Barrio`, sin separadores vacíos; solo ciudad si no hay dirección).
- **Health Score compacto**: puntaje + estado + recomendaciones pendientes (dejó de ser el bloque protagonista).
- **Sección "Seguimiento"** (debajo de Propietario, solo en propiedades existentes): stats (última visita, último contacto con propietario, visitas, consultas=placeholder "—").
- **Registrar visita** (modal: fecha, hora, interesado, agente, comentario interno, checkbox "Avisar al propietario por WhatsApp"). Al guardar: persiste, actualiza stats, genera **mensaje para el propietario** (anonimiza al interesado) con botón **Copiar mensaje** (NO envía WhatsApp automático).
- **Timeline** limpio (sin tablas): "Hoy · Visita realizada · {interesado}" y "WhatsApp enviado al propietario" cuando corresponde.
- Backend: nueva tabla Supabase `public.property_visits` (migración en `supabase_schema.sql`, corrida por el usuario), endpoints `GET/POST /api/properties/{id}/visits`.

### Nota deployment: estos cambios están en PREVIEW. Para verlos en producción (real-estate-os-10.emergent.host) hay que REDESPLEGAR. La tabla `property_visits` ya existe en el proyecto Supabase (compartido preview/prod).

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

## Implemented (Sprint "Ubicación Inteligente" — 2026-06)
Autocompletado de direcciones (Google Places) + mapa interactivo (@vis.gl/react-google-maps) reemplazan los campos manuales de ubicación. Campos geo (latitude, longitude, googlePlaceId, formattedAddress, province, postalCode, country) persisten en Supabase. Backend verificado 6/6 pytest (round-trip camelCase↔snake_case, iteration_15). El bloqueo de facturación de Google Cloud fue resuelto por el usuario. Ref: `LocationSection.tsx`, `test_location_roundtrip.py`.

## Implemented (Sprint "Cerrar módulo Información" — 2026-06)
Cierre del bloque Información para el piloto. Verificado 100% (iteration_16): backend 4/4 pytest, frontend E2E verde. Sin bugs, sin cambios de arquitectura, sin mocks visibles, tsc limpio.
- **Precio con separador de miles** (visual): input controlado (`formatThousands` regex) muestra `1.250.000` mientras el valor interno queda en dígitos limpios (`1250000`). Persiste como número al backend y se re-formatea al editar. Solo frontend (`BasicInfoSection.tsx`).
- **IA para el título** (Gemini 3 Flash vía Emergent LLM key): acción discreta "✨ VERA sugiere un título" bajo el campo Título → panel desplegable con 3 títulos SEO distintos (máx. 70 chars, sin inventar datos), cada uno con "Usar este título" + "Generar otras". VERA nunca sobrescribe: aplicar es decisión del usuario.
- **Endpoint reutilizable** `POST /api/ai/content` con parámetro `mode` (hoy `title`; preparado para `description`, `highlights`, variantes por portal Mercado Libre/Zonaprop). Arquitectura: `TitleSuggestions.tsx` → `useTitleSuggestions` → `AiContentService` → `ApiAiContentGateway` → backend `ai_content_service.py` (el frontend nunca toca el LLM).
- **Regla F documentada** en `/app/docs/WORKSPACE.md`: "VERA propone, el profesional decide" — toda IA en VERA genera sugerencias, nunca sobrescribe.
- Backend nuevo: `ai_content_service.py`, `routes_ai.py`, schemas `AiContentRequest/Response`, `config.ai_configured()`, `EMERGENT_LLM_KEY` en `.env`. Tests: `test_ai_content.py`.

## Implemented (Sprint "Cerrar módulo Características" — 2026-06)
El módulo pasó de "formulario" a **base de conocimiento** de la propiedad (fuente única de verdad para IA, portales, tasaciones, filtros). Verificado 100% (iteration_17): backend 6/6 pytest, frontend E2E verde, tsc limpio, compatible con propiedades existentes.
- **Separación conceptual**: "Características" (datos OBJETIVOS: ambientes, dormitorios, baños, toilettes, superficies cubierta/semicubierta/lote, plantas, piso, cocheras cubiertas/descubiertas, orientación, estado de conservación, año) en un panel; "Amenities" (ATRIBUTOS) en panel propio.
- **Amenities estructurados**: lista plana de **claves canónicas** en columna `amenities` (jsonb). Catálogo único `amenities-catalog.ts` (6 categorías, 60+ items, claves↔labels). `amenityLabels(keys)` es el puente para IA/portales. Buscador en tiempo real (insensible a acentos).
- **Piso condicional** (solo departamento/oficina/local, `FLOOR_TYPES`). **Antigüedad derivada** del año de construcción (no se duplica el dato). Estado de conservación y orientación como selects.
- Backend: 12 columnas nuevas (migración idempotente en `supabase_schema.sql`, corrida por el usuario), schemas + serializer con defaults seguros para propiedades legacy. Tests: `test_property_knowledge_base.py`.
- Archivos: `FeaturesSection.tsx` (reescrito), `AmenitiesSection.tsx` (nuevo), `amenities-catalog.ts` (nuevo), `form-schema.ts`, `PropertyWorkspace.tsx`, `TitleSuggestions.tsx` (ahora manda labels al LLM).
- Nit conocido no bloqueante: helper `str()` en toForm convierte 0→'' al recargar (cosmético, placeholder cubre; mismo patrón preexistente).

## Implemented (Sprint "Contenido IA + Filtros" — 2026-06)
4 features reusando `POST /api/ai/content` con `mode`. Verificado 100% (iteration_18): backend 10/10 pytest, frontend E2E verde, sin regresiones. Regla "VERA propone, el profesional decide" respetada en todas.
- **Descripción IA** (mode=description): 1 descripción profesional (~600-900 chars) desde características+amenities; "Usar esta descripción" / "Generar otra"; nunca sobrescribe (reemplazó el mock `generateDescription`).
- **Destacados** (mode=highlights): 4-6 bullets de fortalezas, "Copiar todos" / "Generar otros"; no se persisten (contenido derivado).
- **Portales** (mode=portal): selector Mercado Libre / Zonaprop → título + descripción adaptados al formato de cada portal (ML sin datos de contacto), con copiar por bloque.
- **Filtros** en lista de Propiedades (client-side): tipo, operación, precio min/max, dormitorios mín, y amenities multi-select (semántica AND). Botón "Filtros" con contador + "Limpiar filtros".
- Arquitectura: backend `ai_content_service.generate_content(mode,data)->{suggestions,title,body}`; frontend gateway/servicio ampliados; `ai-context.ts` (buildAiContext, único mapeo form→contexto IA, amenities como labels); hook genérico `useAiContent`. Nuevos: `HighlightsSection`, `PortalsSection`, `PropertyFilters`. Reescrito `DescriptionSection`.
- Tests: `test_ai_content.py` (10 casos).

## Implemented (Sprint "Publicación express" — 2026-06)
Botón de un clic que orquesta los 4 modos: genera **título + descripción + destacados + textos de Mercado Libre y Zonaprop** en una sola llamada. Verificado por curl (endpoint) + screenshot E2E sobre propiedad real (todos los bloques con datos reales, sin inventar).
- Backend: `POST /api/ai/express` + `ai_content_service.generate_express(data)` (usa `asyncio.gather`: wave 1 = title/description/highlights en paralelo; wave 2 = ML/ZP portales adaptados desde el título+descripción recién generados). Schema `ExpressResponse` (titles, description, highlights, mercadolibre, zonaprop).
- Frontend: `ExpressSection.tsx` (nuevo panel "Publicación express" antes de Descripción), gateway `generateExpress`, servicio `generateExpress`. Copiar por bloque + "Copiar todo". VERA propone; no sobrescribe la propiedad.

## Implemented (Sprint "Simplificar Workspace" — 2026-06)
Reorganización UX: el Workspace pasa de "suma de formularios" a **panel de control comercial**. Verificado 100% (iteration_19): backend 9/9 pytest, frontend E2E verde, tsc limpio.
- **Renombres**: Información→"Datos de la propiedad" (arranca con Operación), Publicación Express→"Contenido comercial", Seguimiento→"Actividad comercial", Publicar en Portales→"Canales de publicación".
- **Eliminados**: paneles Descripción, Destacados y "Publicar en portales" (su contenido vive en Contenido comercial) + el "VERA sugiere un título" inline. Archivos borrados: DescriptionSection, HighlightsSection, PortalsSection, TitleSuggestions, useTitleSuggestions.
- **Contenido comercial (Express)** ahora tiene **"Usar este título"** y **"Usar esta descripción"** (setValue + persist), quedando como único lugar de generación de contenido.
- **Centro de Publicación (Canales)** — NUEVO tablero de estado por canal: Web Varela + Mercado Libre operativos (Publicar/Actualizar/Despublicar → estados published/none + lastSync); Zonaprop + Argenprop "Próximamente". Escalable (catálogo `channels-catalog.ts`, config `ENABLED_PUBLICATION_CHANNELS`). **Tablero MANUAL** (sin API real de portales aún): VERA registra y muestra; nunca publica sola.
- Backend: columna `publications` jsonb (migración corrida), `POST /api/properties/{id}/publications/{channel}` (publish/update/unpublish, 422 canal/acción inválidos), clave camelCase `lastSync`. Frontend: `publication-gateway.ts` + `publication-service.ts` + `ChannelsSection.tsx`. Tests: `test_publications.py` (9).
- Nits no bloqueantes: sin botón "Reintentar" explícito ante error de canal (recuperable con Publicar); descripción sin textarea manual (intencional, vive en Contenido comercial).

## Implemented (Ajustes UX — 2026-06)
- **Reintentar en canales**: ante estado `error`, el canal muestra un botón "Reintentar" (`retry-{ch.id}`) que re-ejecuta la última acción intentada (publish/update/unpublish). `ChannelsSection.tsx`.
- **Descripción manual**: en "Contenido comercial" hay un toggle colapsable "Editar descripción a mano" (`toggle-manual-description`) que revela un `<Textarea>` ligado a `description` (`manual-description`) con contador; se guarda con el resto del formulario. Permite ajustar la descripción sin regenerar con IA. `ExpressSection.tsx`.
- Verificado por tsc + screenshot. Backend sin cambios. Pendiente por decisión del usuario: conexión real de Mercado Libre/Zonaprop (se hará "cuando quede todo diseñado").

## Implemented (Sprint "Canales+, Duplicar, Express UX" — 2026-06)
Verificado 100% (iteration_20): backend 12/12 pytest + frontend E2E verde, tsc limpio, sin residuos.
- **Link de aviso por canal** (auto-sync fase 1): estado en vivo ⏳ Sincronizando → 🟢/🔴 (ya existía en cada acción) + **link directo al aviso** por canal ("Agregar/Editar link" → "Ver aviso ↗"), persistente. Hoy el asesor pega el link a mano; cuando se conecten las APIs reales de ML/Zonaprop, el mismo campo se completa solo (sin rehacer UI). Backend: `PublicationAction.url` (None=no cambiar / ""=limpiar / valor=setear); "Actualizar" preserva el link, "Guardar" con campo vacío lo limpia.
- **Duplicar propiedad**: `POST /api/properties/{id}/duplicate` clona la ficha (datos + amenities + características), title "(copia)", status active, code NUEVO, publications {}, **sin fotos/documentos**. Menú "…" → "Duplicar" navega a la copia. `duplicate()` en repo/servicio.
- **Express UX**: "Usar esta descripción" ahora **abre automáticamente** el textarea manual (`manual-description`) con el texto cargado para retocar antes de guardar.
- Tests: `test_sprint20.py` (12). Nits menores documentados (clase css compartida en input de link; responsive del editor no verificado) — no bloqueantes.

## Implemented (Sprint "Workspace Personal — Ambient Intelligence UI" — 2026-06)
La pantalla "Hoy" dejó de ser una lista de recomendaciones (TodayScreen, eliminado) y pasó a ser un **escritorio tipo OS** (WorkspaceHome). Verificado 100% (iteration_21): frontend E2E 11/11, 0 errores de consola, tsc limpio.
- **Dashboard Engine** (`app/workspace/`): widgets activables/reordenables desde "Personalizar". Registro único `widget-registry.tsx` (id, title, icon, size sm/md/lg, defaultEnabled, demo). Estado (encendidos + orden) persistido por usuario en `localStorage` (`vera:dashboard:{email}`) vía `useDashboard`.
- **Dock estilo OS** (`Dock.tsx` + `apps-catalog.ts` + `useDock`): apps favoritas fijables (`vera:dock:{email}`). Solo `propiedades` es `ready` (navega); el resto muestra tooltip "Próximamente" y no navega. Default pin: propiedades/operaciones/personas.
- **Ambient Intelligence UI** (`index.css`): 3 glows radiales sutiles (drift lento, guard `prefers-reduced-motion`), cards glass con hover flotante, entrada escalonada (`animationDelay`). Namespace propio `vera-home*`/`vera-widget*`/`vera-w-*`/`vera-dock*` (renombrado para NO colisionar con `vera-workspace*` del Property Workspace).
- **Widgets**: `greeting` (reloj/fecha en vivo), `prioridades` (REAL, consume el VERA Intelligence Engine vía `useToday().data.recommendations`), `audio` (REAL — streams de radio Aspen/Rock&Pop, funcional por decisión del usuario). MOCK (badge "Demo", Fase 1): favoritos, agenda, tareas, actividad, clima, noticias, cotizaciones.
- **Bug corregido**: `PrioridadesWidget` leía `useToday()` como array; ahora usa `data.recommendations` y `r.target` (antes `r.route`).
- Router: `/hoy` → `WorkspaceHome` (VeraOS.tsx). `TodayScreen.tsx` eliminado.
- Nits no bloqueantes (documentados en iteration_21): sin feedback visual cuando el stream de audio falla; apps no-ready conservan `route` en el catálogo.

## Implemented (Marca oficial — Logo VERA OS v1.0 — 2026-06)
Se aplicó el kit de marca definitivo ("Brand Freeze v1.0") provisto por el usuario. Assets en `/app/frontend/src/assets/brand/` (logo-horizontal/vertical, app-icon, favicon) y `/app/frontend/public/` (favicon.png, logo192/512.png, manifest.json).
- **Login** (`LoginScreen.tsx`): lockup horizontal (`logo-horizontal.png`, símbolo V + "VERA OS") reemplaza el mark de texto.
- **Sidebar** (`packages/ui/Sidebar.tsx` + `ui.css`): app-icon (tile redondeado con V) como `brand-mark` (img) + wordmark "VERA OS".
- **Navegador**: favicon.png, apple-touch-icon, `manifest.json` (theme `#1C1C1C`), title "VERA OS — Real Estate Intelligence".
- Regla de marca (README del kit): NO modificar colores/proporciones/inclinación; símbolo=amarillo `#F6E63A`. Verificado por screenshot (login + sidebar), tsc limpio, sin errores de consola.

## Implemented (Sprint "Workspace Experience 01 — Refinement" — 2026-06)
Refinamiento para que "Hoy" se sienta un Sistema Operativo Comercial (no un CRM). SIN rediseño; tokens de marca congelados. Verificado 100% (iteration_22): frontend E2E, 0 errores de consola, tsc limpio. Disciplina de arquitectura acordada con el usuario: clasificar cada funcionalidad como **App / Widget / Dock / Integración / Capa IA** antes de implementarla.
- **P1 Sidebar** (App): nav = Hoy, Vera Bot, Propiedades, Personas, Operaciones, Studio (Vera Bot ahora es App principal, misma jerarquía que Propiedades). Vera Bot/Personas/Operaciones/Studio = "Próximamente" (flags `veraBot`/`personas` nuevos en `feature-flags.ts`, rutas placeholder en `VeraOS.tsx`). Logo: `logo-horizontal.png` en el brand (recupera identidad). Item activo con glow amarillo (box-shadow + barra de acento), no solo color.
- **P2 Dock** (Dock): rediseñado como **herramientas personales** (Gmail, IA, Instagram, Calendar, Drive, WhatsApp, Spotify) — abren su web real en pestaña nueva (`window.open _blank`). Ya no contiene módulos de VERA. `apps-catalog.ts` → `DockTool {id,label,icon,href}`. Default pins: gmail/ia/calendar/whatsapp/spotify.
- **P3 Calendario** (Widget): nuevo widget de vista mensual (mock), distinto de Agenda (lista). Hoy resaltado + dots de eventos. Registrado en `widget-registry` (size sm, demo, default on).
- **P4 Ambient Intelligence UI** (capa visual): halos ambientales muy sutiles con el primario (sin imágenes ni gradientes fuertes); hover de widgets con elevación + glow suave (sin sombras pesadas); glow del item activo en sidebar; iluminación sutil en botón primario (hover); respiración lenta del header (`vera-breathe` 11s); cards con menos "caja" (borde/contraste en vez de sombra). Todo con guard `prefers-reduced-motion`, transiciones 200–500ms, easing natural.
- **P5 Personalización** (UX): los chips se reemplazaron por botón **"Personalizar escritorio"** que abre un **panel lateral** (`CustomizePanel`, portal a body) con checkboxes por widget (solo encender/apagar; reordenar llegará con Drag & Drop). Se removieron los controles de reorden inline de las cards.
- **P6 Home** más calma/aire (más espaciado y gaps).
- **P7 Capa IA reservada**: barra estilo Spotlight/Raycast "¿Qué querés hacer hoy? Preguntale a VERA…" → abre `SpotlightModal` (portal, placeholder, sugerencias "Próximamente"). NO ejecuta IA todavía.
- Nuevos archivos: `SpotlightModal.tsx`, `CustomizePanel.tsx`. Assets: `src/assets/brand/vera-symbol.png`, `logo-horizontal.png`.
- Nota técnica: modal/panel usan `createPortal(document.body)` para escapar el stacking context de `.vera-home` (isolation) y quedar sobre el TopBar sticky.

## Implemented (Sprint "Workspace Experience 02 — Identity & Ambient Intelligence" — 2026-06)
De "software bien diseñado" a "producto con identidad propia". Sin nuevas features ni cambio de identidad visual. Verificado 100% (iteration_23): frontend E2E 10/11 (audio stream limitado por sandbox), 0 errores de consola, tsc limpio.
- **DECISIÓN DE ARQUITECTURA — `WorkspaceConfig`** (`packages/config/workspace-config.ts`): objeto global `{ name, logo, symbol, tagline, theme, accent }`, fuente ÚNICA de identidad. Toda la UI lo consume; NADA hardcodeado. Cambiar de vertical (Real Estate → Legal/Water/Health) = cambiar solo este objeto, sin tocar la UI. `Sidebar` pasó a presentacional (`logoSrc`/`tagline` por props); `AppLayout` lo alimenta desde `workspaceConfig`.
- **Sidebar branding**: logo horizontal + descriptor **"REAL ESTATE INTELLIGENCE"** (DM Sans 11px medium, letter-spacing amplio, color secondary, aire) como firma del sistema. El tagline viene de `WorkspaceConfig.tagline`.
- **Ambient Intelligence (global)**: halo enorme y muy transparente (solo primario) detrás del Workspace (`.vera-shell__ambient` en el shell), respira lento (`vera-halo-breathe` 18s) y **cambia de posición suavemente al cambiar de App** (`data-app` + transición 1.8s). Se removió el halo propio del Home (ahora es global, presente en todas las pantallas).
- **Spotlight (presencia de IA)**: badge "VERA" con glow sutil + microanimación en hover; sigue abriendo el modal placeholder.
- **Dock**: más blur/profundidad/separación — sensación de objeto flotante (percepción tipo macOS, sin copiar diseño).
- **Widgets con personalidad**: Audio con ecualizador animado al reproducir (`.vera-w-audio__eq`); Calendario con día actual iluminado (glow, no solo color); Cotizaciones anima solo el número al cambiar (interval mock ~4s + `is-flash`); Prioridades con leve iluminación al hover.
- **Workspace** con más aire (gap 2xl).
- Principio visual permanente documentado: "¿Este efecto ayuda a trabajar mejor o solo decora?" — si solo decora, se elimina.

## Filosofía de producto (clasificación permanente — Sprint 02)
Toda nueva funcionalidad se clasifica ANTES de desarrollarse, en UNA sola categoría:
- **Apps**: Workspaces completos (Propiedades, Studio, Vera Bot, Personas, Operaciones).
- **Widgets**: información / acciones rápidas (Audio, Calendario, Agenda, Noticias, Clima, Cotizaciones, Favoritos, Tareas, Actividad, Prioridades).
- **Dock**: herramientas personales externas (Gmail, WhatsApp, Drive, Spotify, Instagram, Calendar, IA).
- **Integraciones**: servicios externos (Google, Meta, Dropbox, Mercado Libre).
- **IA**: transversal — no pertenece a ninguna categoría; puede aparecer en cualquier parte.

## Roadmap (anotado, no implementado)
- **Workspace Context** (gran salto futuro): el sistema se vuelve CONTEXTUAL — al abrir "Propiedades" el halo, el Spotlight y los widgets priorizan info inmobiliaria; en un Workspace de otra vertical el contexto cambia sin cambiar la identidad visual. Potencial diferencial clave de VERA OS.

## Notes for continuation (no chat history needed)
- Swap mocks in `src/packages/services/service-container.ts` (single wiring point).
- New App = new screen + feature-flag flip in `@vera/config` + route in `VeraOS.tsx`.
- All visual values come from `@vera/design-tokens`; never hardcode.
