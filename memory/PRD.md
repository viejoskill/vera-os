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

## Implemented (Infra de marca — BrandRegistry + BrandIcon — 2026-06)
Infraestructura para consumir logos OFICIALES de integraciones/herramientas sin romper nada (NO se generaron logos; se esperan los PNG oficiales del usuario). Verificado por screenshot (fallback vectorial OK) + tsc limpio.
- **Carpeta** `/public/brands/` (con README de convención de nombres). Nombres estandarizados SIN prefijos: `gmail.png`, `calendar.png`, `drive.png`, `gemini.png`, `openai.png`, `claude.png`, `whatsapp.png`, `spotify.png`, `instagram.png`, `facebook.png`, `linkedin.png`, `youtube.png`, `tiktok.png`, `notion.png`, `slack.png`, `trello.png`, `canva.png`.
- **`BrandRegistry`** (`packages/config/brand-registry.ts`): mapa centralizado `key → /brands/{key}.png` (usa `PUBLIC_URL`). `brandSrc(key)` resuelve la URL. `BrandKey` tipado.
- **`BrandIcon`** (`packages/ui/BrandIcon.tsx`): muestra el PNG oficial si carga; si no existe (o falla), cae automáticamente al ícono vectorial (`fallback: LucideIcon`) vía `onError`. Cuando se suban los PNG, el cambio es automático sin tocar Dock ni pantallas.
- **`apps-catalog.ts`**: cada `DockTool` ahora tiene `brand` (gmail/openai/instagram/calendar/drive/whatsapp/spotify). `Dock.tsx` usa `<BrandIcon brand fallback={icon} />` en la barra y el picker.

## Implemented (Logos de marca — assets + tratamiento mono — 2026-06)
- Se subieron 10 PNG oficiales (siluetas negras sobre transparente) a `/public/brands/` con nombres estandarizados: `calendar, gemini, openai, youtube, meta, spotify, claude, canvas, dropbox, mercadopago`. Pendientes (fallback vectorial): gmail, whatsapp, instagram, drive, tiktok, linkedin, facebook, notion, slack, trello, canva.
- `BrandRegistry` (`brand-registry.ts`) ampliado con claves: `meta, dropbox, canvas, mercadopago`.
- **Tratamiento monocromático** en `BrandIcon` (`packages/ui/BrandIcon.tsx`): prop `mono` (default `true`) → clase `.vera-brand-icon--mono { filter: brightness(0) invert(1); }` que pinta la silueta en blanco (nítida sobre tema oscuro). Para logos a color futuros: `mono={false}`.
- Verificado por screenshot: Dock muestra calendar/openai/spotify en blanco; los faltantes caen a ícono vectorial. tsc limpio.
- Notas de mapeo: `openai.png` es el hexágono de OpenAI Gym (no la flor clásica); `canvas` (Canvas LMS) ≠ `canva`; `mercadopago` = apretón de manos.

## Actualización logos (2026-06 · lote 3)
Sumados `gmail.png`, `instagram.png`, `facebook.png` a `/public/brands/` (nombres estándar, claves ya existentes). Total: 13 logos. Del Dock, solo restan `whatsapp.png` y `drive.png` en fallback vectorial. Verificado por screenshot.

## Actualización logos (2026-06 · lote 4 — Dock completo)
Sumados `whatsapp.png` y `drive.png` (googledrive → drive). Total 15 logos en `/public/brands/`. El Dock quedó 100% con logos oficiales (sin fallback vectorial). Verificado por screenshot.

## Implemented (Widgets en vivo — Radio + Clima + Dólar — 2026-06)
Tres widgets pasaron de mock a datos reales. Verificado por screenshot + curl (datos coinciden), tsc limpio.
- **Audio (radio)**: arregladas las URLs de streaming (estaban caídas). Aspen 102.3 → redirect oficial StreamTheWorld (`playerservices.streamtheworld.com/api/livestream-redirect/ASPEN.mp3`); Rock & Pop 95.9 → `ipanel.instream.audio:7002/stream`. Se setea `volume` antes de `play()`, y hay estados "Conectando…/En vivo/En pausa/No disponible" con `onError`/`onPlaying`. Confirmado que reproduce ("En vivo" + ecualizador animado).
- **Clima**: `useWeather` (`app/hooks/useWeather.ts`) → Open-Meteo (sin API key, CORS), Buenos Aires; mapea WMO code → descripción/ícono; refetch 10 min.
- **Cotizaciones (Dólar hoy)**: `useDolar` (`app/hooks/useDolar.ts`) → DolarApi (`https://dolarapi.com/v1/dolares`, sin key, CORS); muestra Oficial/Blue/MEP (venta), refetch 60s, anima el número al cambiar. Se quitó el `delta` mock.
- Ambos widgets (clima, cotizaciones) dejaron de ser `demo` en el registry. Fetch directo a APIs públicas (keyless) vía react-query.

## Actualización widgets en vivo (2026-06 · radios + clima Costa del Este)
- **Audio**: 5 emisoras (URLs HTTPS verificadas 200): Aspen 102.3, Rock & Pop 95.9, La 100 99.9 (`FM999_56AAC` vía StreamTheWorld), Metro 95.1 (`METRO` STW), Vorterix 92.1 (`ice2.edge-apps.net/radio1_high-20057.audio`).
- **Clima**: `useWeather.ts` ahora apunta a **Costa del Este** (lat -36.0281, lon -56.6811), no Buenos Aires.

## Actualización "Prioridades de hoy" (2026-06 · miniatura de propiedad)
`PrioridadesWidget` (`widgets.tsx`) ahora muestra la foto principal (`property.coverImage`, vía `useProperties`) como miniatura 80×60 (redondeada, anillo por prioridad: `--vera-color-priority-*`) cuando la recomendación es de una propiedad con imagen. Componente `PrioThumb` con fallback automático al punto de prioridad si la imagen falla/no existe. Preparado para futuros tipos (Cliente/Visita/Documento/Seguimiento): miniatura solo si hay imagen asociada. Verificado (foto real carga, naturalWidth 1536).

## Rediseño "Prioridades de hoy" → hero card (2026-06)
`PrioridadesWidget` pasó de lista a **hero card** (según mockup del usuario): foto principal de la propiedad como fondo full-bleed (`background-image`, con `margin` negativo para cancelar el padding del body), scrim degradado inferior, título grande, subtítulo, badge de prioridad (alta=amarillo / atencion=ámbar / lista=verde) y botón "Ver detalles →". Muestra la prioridad top del día; card clickeable → navega a la propiedad. Fallback `--noimg` (degradado) si no hay foto. Verificado por screenshot.

## Dock — catálogo ampliado + colores + visibilidad (2026-06)
- Colores de marca aplicados a los íconos del Dock vía `BrandColors` + `BrandIcon` (silueta como máscara teñida con el hex oficial). 12 marcas con color; mono blanco si no hay color; fallback lucide si no hay PNG.
- Catálogo del Dock (`apps-catalog.ts`) ampliado a 13 herramientas: gmail, ia(openai), claude, gemini, instagram, meta, youtube, whatsapp, spotify, drive, dropbox, mercadolibre, canva. Cada una con href real. Se quitó `calendar` (redundante con el widget Calendario).
- `mercadolibre` (amarillo #FFE600, reusa el PNG del apretón de manos) linkea a mercadolibre.com.ar.
- Visibilidad: `.vera-dock__app` ahora tiene tile sutil (bg translúcido + borde) estilo macOS para que los íconos oscuros (ej. OpenAI cian) se lean bien.
- Colores: gmail #EA4335, openai #0081A5, claude #D97757, gemini #8E75B2, instagram #FF0069, meta #0467DF, youtube #FF0000, whatsapp #25D366, spotify #1ED760, drive #4285F4, dropbox #0061FF, mercadolibre #FFE600. (canva sin color → fallback lucide.)

## Sprint 04 — Vera Bot como INTEGRACIÓN (motor: Arturito) (2026-06/07)
Cambio de alcance definido por el "Product Philosophy v1.0" del usuario: **VERA orquesta, no reconstruye**. Vera Bot deja de ser mensajería propia y pasa a ser una integración desacoplada de Arturito.
- **Capa `MessagingProvider`** (`app/vera-bot/types.ts`): contrato único (id, name, brand, tagline, description, channels, mode `launch|embed`, url, online). Cambiar de motor = implementar la interfaz + 1 línea en `provider.ts`. El resto de VERA OS no se toca.
- **Proveedor inicial Arturito** (`app/vera-bot/providers/arturito-provider.ts`): modo `launch`, url `https://app.arturito.ai`, canales whatsapp/instagram/facebook/web. (Arturito no expone API pública de bandeja para terceros → integración por lanzamiento, no embed.)
- **Punto de acoplamiento** `app/vera-bot/provider.ts` → `messagingProvider = arturitoProvider`. Hook `useMessaging()` (`{ provider, launch }`) es lo único que consume la UI.
- **UI nativa** `VeraBotWorkspace.tsx`: header + cápsula de estado "VERA ONLINE" (pulso verde), indicadores multicanal, hero del motor (tile de marca vía `BrandIcon` fallback `Bot`, botón "Abrir Arturito" → `window.open` nueva pestaña, nota de sesión segura), y 3 capas futuras "Próximamente" (Vera Expert, Acciones rápidas, Automatizaciones) — arquitectura preparada sin construirlas.
- Router: `VeraOS.tsx` monta `<VeraBotWorkspace/>` en `/vera-bot`; flag `veraBot: true`. Brand `arturito` agregado a `brand-registry.ts` (sin PNG aún → fallback vectorial `Bot`).
- Se eliminaron los archivos del enfoque anterior (mock-provider/useConversations/ConversationProvider). CSS en `index.css` bajo `.vera-bot__*`. Verificado por screenshot (login QA → /vera-bot renderiza).
- **Pendiente futuro**: si Arturito habilita API pública, migrar `mode` a `embed` (bandeja real embebida) sin tocar la UI. Considerar `arturito.png` oficial en `/public/brands/`.

## Sprint — Legacy CRM Migration (exportador ↔ importador desacoplados) (2026-07)
Migración ÚNICA e IDEMPOTENTE de 23 propiedades del CRM Legacy al Workspace de VERA. Enfoque del usuario: el CRM **exporta**, VERA **importa**; ambos desacoplados (al apagar el CRM, se borra el exportador y VERA sigue igual). Verificado E2E (curl 4 corridas + screenshot UI): 24 propiedades totales (1 original + 23 legacy), SIN duplicados, imágenes visibles en las tarjetas.
- **CRM Legacy exportador** (`/app/backend/legacy_crm/`, AISLADO/desechable): `GET /api/export/properties` devuelve 23 propiedades con esquema PROPIO (campos en español) + imágenes/documentos como URLs. Distinto del esquema de VERA a propósito, para forzar el mapeo explícito.
- **VERA importador** (`/app/backend/legacy_import/`): `importer.py` (fetch export → mapeo EXPLÍCITO LegacyProperty→Property → persiste vía PropertyRepository → descarga imágenes/documentos por URL y los re-sube al Storage propio respetando orden; tolerante a errores por-propiedad; job en memoria con progreso); `store.py` (Mongo: mapa idempotente `legacy_id`→`property_id` + log de auditoría). Idempotente por `legacy_id`: reimportar ACTUALIZA en vez de duplicar; imágenes no se re-duplican; no borra nada.
- **Endpoints** (`routes_migration.py`): `POST /api/migration/import-legacy` (inicia job → job_id), `GET /api/migration/status/{job_id}` (progreso: total/processed/created/updated/images/docs/errors).
- **Frontend**: botón "Importar desde CRM Legacy" en Propiedades + `LegacyImportModal` (barra de progreso, propiedad actual, resumen creadas/actualizadas/imágenes/documentos, errores; invalida `['properties']` al terminar).
- **Verificado**: 4 corridas → 24 propiedades sin duplicar; 1ª/2ª corridas fallaban por columnas NOT NULL (`bedrooms/bathrooms/rooms/area_m2`) → corregido con defaults 0; corrida final 23 actualizadas / 0 errores; 4 logs de auditoría + 23 mapeos únicos en Mongo; imágenes (picsum) descargadas y re-subidas al Storage, visibles en las tarjetas.
- **PENDIENTE del usuario (opcional)**: la columna `legacy_id` NO existe en `properties` y no tengo DDL (Supabase hosted). Hoy el `legacy_id` se persiste como mapa en Mongo (idempotencia 100% funcional). Para guardarlo también en la tabla, correr en el SQL Editor de Supabase: `ALTER TABLE properties ADD COLUMN IF NOT EXISTS legacy_id text; CREATE INDEX IF NOT EXISTS idx_properties_legacy_id ON properties(legacy_id);`. El importador ya lo detecta automáticamente y empieza a persistirlo sin cambios de código.
- No se agregó `mercadolibre_id` (se resolverá con un modelo genérico `publication_targets` a futuro).


Cambio de enfoque: dejar de pensar "conversaciones" y construir el dominio de las RELACIONES. El centro es la **Persona** y su relación con el negocio. El diferencial de VERA no es "¿qué propiedades tengo?" ni "¿qué dijo el cliente?", sino **"¿qué debería hacer con María?"** — combinando conversación + memoria + objetivo + cartera + historial + insights. Eso es un **asesor comercial**, no un CRM ni un chatbot. Verificado por curl con datos reales.
- **Dominio `relationships/`**: `types.py` (`Person` = identidad; `RelationshipSnapshot` = vista 360° con conversaciones, propiedades de interés, memoria, goals, insights + slots de dirección `visits`/`tasks` para App Personas); `service.py` (`RelationshipService.all_snapshots()`/`snapshot()` ensambla la vista cruzando las fuentes; Personas DERIVADAS de conversaciones hoy —bridge hasta un PersonProvider/App Personas—; matcher liviano por tokens que vincula lo que pidió la persona con la **cartera real**).
- **`ConversationKnowledgeSource` → `RelationshipKnowledgeSource`** (id `relationships`): no almacena conversaciones, ENRIQUECE la relación. Por Persona: qué pidió + propiedad(es) de la cartera que encajan (por id) + estado (insight) + qué ya se hizo (memoria). Habilita respuestas de asesor.
- **Verificado (curl)**: "¿Qué debería hacer con María?" → VERA combina: preguntó zona+financiación, 2 días sin respuesta, cruza con la casa real de Costa del Este (US$79.000), lead nuevo, y recomienda acciones concretas (retomar hoy, responder las 2 preguntas). Funciona directo en el Spotlight (sin cambios de frontend).
- **Doc `RELATIONSHIPS.md`** (Relationship Foundation: Persona como entidad completa que reúne conversaciones/propiedades/visitas/tareas/memoria/objetivos/insights; el diferencial asesor; camino a App Personas) agregado a `DOC_ORDER`.
- Fuentes del Hub: vera · properties · relationships.


Primer caso de VERA demostrando **inteligencia aplicada al negocio**: la cartera real se transforma en conocimiento sobre el que VERA razona (no un buscador ni un listado). Detrás de un contrato desacoplado (hoy Supabase, mañana otro CRM), sin tocar VERA Brain. Verificado por curl con la cartera real.
- **Contrato `PropertyProvider`** (`/app/backend/properties/`): `types.py` (modelo canónico `Property` con specs completas + señales DERIVADAS: `days_published`, `days_inactive`, `missing` [info incompleta]); `provider.py` (ABC `PropertyProvider` + `SupabasePropertyProvider` que mapea el schema real → dominio + `active_property_provider`). VERA nunca conoce Supabase. Drivers futuros: Tokko, EasyBroker.
- **`PropertiesKnowledgeSource` reescrita** (consume el contrato): entrega por propiedad specs+ubicación+precio+fotos/publicaciones+antigüedad+flags de incompletitud+descripción, más rollups y grupos derivados (info incompleta, antigüedad de publicación) para razonar matching/presupuesto/similares/atención. Incluye nota de honestidad sobre métricas que aún no existen (consultas/mes, último contacto con propietario).
- **Verificado (curl `/api/brain/ask`)**: "¿Qué propiedad para un matrimonio con 2 hijos en Costa del Este, presupuesto USD 90k?" → VERA propone la casa real (US$79k), justifica presupuesto/ubicación y señala limitaciones. "¿Qué necesita atención?" → diagnóstico real (días publicada, actividad, fotos). "¿Qué propietarios contactar?" → honesta: aclara que aún no tiene fecha de último contacto. Funciona directo en el Spotlight (sin cambios de frontend).
- Schema real de `properties`: title, type, operation, price, currency, city/neighborhood/province/address, bedrooms/bathrooms/rooms, area_m2/lot_area_m2, parking_covered/uncovered, amenities, condition, year_built, description, status, archived, owner_id, owner_observations, property_images[], publications[], created_at/updated_at.
- Limitación honesta: hoy hay 1 propiedad real cargada; el valor escala a medida que se suman propiedades (similares/comparaciones/bajo-presupuesto se vuelven más ricos).


Decisión del usuario: **Foundation Freeze** — el modelo cognitivo (Knowledge→Memory→Goals→Brain→Insights→Actions→User) queda CONGELADO. No se agregan más conceptos; el foco pasa a **alimentar el cerebro con conocimiento real** vía Knowledge Sources, en este orden: **VeraKnowledgeSource → Properties Knowledge Source → Conversation Knowledge Source → (recién después) App Personas**. Verificado (curl + screenshot), `tsc` limpio.
- **VeraKnowledgeSource robustecida** (`vera_brain/knowledge.py`): dejó de inyectar ~15KB del PRD (un changelog interno de implementación → ruido y costo en cada llamada). Ahora se alimenta SÓLO de docs curados y permanentes de `/app/docs`. Nuevo doc **`BRAND.md`** (identidad + voz de VERA: cercano, rioplatense, proactivo, honesto; estética Ambient Intelligence, amarillo #F6E63A, tema oscuro) sumado a `DOC_ORDER`. Caché con invalidación por `mtime` (refleja ediciones sin reiniciar). Verificado: VERA describe su identidad/voz correctamente ("Soy VERA… hablo directo, en rioplatense").
- **UX**: "Tu foco ahora" → **"Objetivo activo"** (GoalBar), más consistente con el modelo cognitivo.
- **Goals · scope (diseñado, no implementado)**: `Goal` ahora tiene `scope` (global | workspace | entity) + `scope_type` + `scope_id`, default `global`. Endpoint `POST /api/brain/goals` y el gateway aceptan estos campos. Prepara objetivos por Persona/Propiedad/Oportunidad sin migración futura.
- Docs de VERA actuales: VISION, COGNITION, FOUNDATION, BRAND, PROVIDERS, WORKSPACE, ROADMAP, PILOT.


Tercer pilar cognitivo introducido por pedido del usuario: **Goals** = lo que VERA intenta lograr. El razonamiento del Brain SIEMPRE se hace en función del objetivo actual (qué priorizar, qué proponer). Modelo cognitivo definitivo de VERA (registrado en `/app/docs/COGNITION.md`, conocido por VERA): **Knowledge** (sabe) → **Memory** (aprendió) → **Goals** (intenta lograr) → **Brain** (razona) → **Insights** (descubre) → **Actions** (propone) → **User** (decide). No depende de inmobiliarias, Arturito ni de un modelo de IA. Verificado E2E (curl + screenshot), `tsc` limpio.
- **Backend `vera_brain/goals.py`**: `Goal` estructurado (`{id, type, title, subject, status, priority, at, meta}`); tipos `sell_property · capture_owners · prioritize_rentals · increase_appraisals · custom`. Store file-based (`vera_goals.json`) con `set_goal/set_status/list/active/as_context`. (Fix: `from __future__ import annotations` — el método `list` sombreaba al built-in en las anotaciones.)
- **Wire al Brain** (`vera_brain/brain.py`): `_system()` inyecta "OBJETIVO ACTUAL DEL USUARIO (GOALS)" al tope + regla 6 ("razoná SIEMPRE en función del objetivo"). Verificado: con objetivo "Vender la casa de Costa del Este", VERA lo reconoce, lo cruza con la propiedad real y prioriza a Juan (contacto de Costa del Este).
- **Endpoints** (`routes_brain.py`): `GET /api/brain/goals` (activos; `?all=true`), `POST /api/brain/goals`, `PATCH /api/brain/goals/{id}` (status).
- **Frontend**: `GoalBar.tsx` (nueva sección "TU FOCO AHORA" en Hoy, debajo del TodayHero) con presets + objetivo custom + chips con archivar; `brain-gateway.ts` con `goals/setGoal/updateGoal`; react-query key `['goals']`. CSS `.vera-goal*`.
- **Doc**: `COGNITION.md` (modelo cognitivo + principios permanentes: Knowledge≠Memory, razonar según Goals, Memory no guarda conversaciones, Memory visible debe sentirse útil) agregado a `DOC_ORDER`.
- Estado limpio: goals arrancan vacíos (el usuario define su foco).


Refinamiento conceptual del usuario: **Memory** es un único concepto (las decisiones son sólo UNA categoría), **estructurado y tipado**, que **influye** en cómo VERA razona. Arquitectura conceptual acordada: **Knowledge** (lo que VERA sabe del negocio) → **Memory** (lo que VERA aprendió con este usuario) → **Insights** (lo que detectó) → **Brain** (cómo razona) → **Actions** (lo que propone) → **User** (quien decide). Regla permanente: **Memory NUNCA guarda conversaciones completas** (eso es del ConversationProvider); sólo lo que merece recordarse por su valor futuro. Verificado E2E (curl + screenshots), `tsc` limpio.
- **`MemoryEntry` estructurado** (`vera_brain/memory.py`): `{id, type, subject, action, detail, confidence, at, meta}`. Tipos (`MEMORY_TYPES`): **decision · preference · relationship · context · learned_pattern** (crecer = sumar tipo, sin cambiar arquitectura). `recall(types, subject, limit)` filtrable; `for_subject(subject)` = **punto de integración para App Personas** (una Persona consulta su memoria asociada). `as_context()` agrupa por tipo para el Brain. Tolera registros viejos (`kind/note`).
- **Endpoints** (`routes_brain.py`): `GET /api/brain/memory?type=&subject=&limit=`; `POST /api/brain/remember` acepta el modelo estructurado (compat: `note`→`detail`). Memory sigue inyectándose en el system de VERA Brain.
- **Aprendizaje (influencia real)**: `FollowUpRule` consulta Memory y **NO vuelve a sugerir un contacto ya contactado** — si hay un `decision/follow_up_sent` para ese `subject` posterior al último mensaje del cliente, se suprime la oportunidad (re-aparece si el lead vuelve a escribir). Verificado: marcar "ya le escribí a Juan" → oportunidades 3→2, el chip de Juan desaparece de Hoy y del Spotlight.
- **Frontend** (`brain-gateway.ts`, `SpotlightModal.tsx`): `remember` envía recuerdo estructurado (`type:'decision', subject, action:'follow_up_sent', detail`); al marcar decisión se **invalida `['insights']`** para que Hoy/Spotlight se actualicen al instante. Franja "VERA RECUERDA" lee `type=decision`.
- **Doc**: separación Knowledge/Memory reforzada; Memory MVP file-based global (`vera_memory.json`), escalará a Supabase por-usuario/por-Persona sin cambiar interfaz.


El Spotlight dejó de ser una consulta suelta: ahora VERA **recuerda tus decisiones** (a quién ya le escribiste) usando la capa Memory existente. VERA se siente un asistente que te acompaña en el tiempo. Verificado E2E (curl + screenshots): marcar decisión → persiste → aparece en la franja "VERA RECUERDA" → VERA la recuerda al preguntar. `tsc` limpio.
- **Backend**: nuevo `GET /api/brain/memory` (lista decisiones/notas). `POST /api/brain/remember` ya existía. La Memory ya se inyecta en el system de VERA Brain (`memory.as_context()`), así que VERA "sabe" lo recordado al responder (verificado: "¿A quién ya le escribí?" → "Le escribiste a Sofía Ramírez").
- **Frontend** (`SpotlightModal.tsx` + `brain-gateway.ts`): al abrir, carga la memoria y muestra una franja **"VERA RECUERDA"** con las últimas decisiones. Al seguir un contacto ("Seguir con Juan") aparece un botón verde **"Ya le escribí a {nombre}"** → registra la decisión (optimista + persiste vía `remember`), VERA confirma "Anotado ✓" y la franja se actualiza. CSS `.vera-spot__memory*` / `.vera-spot__decision*`.
- Estado: memoria arranca vacía (limpia y honesta); se construye con el uso. MVP file-based global (`vera_memory.json`), escalará a Supabase por-usuario sin cambiar la interfaz.


Decisión arquitectónica del usuario: **VERA no se diseña alrededor de herramientas de terceros; se diseña alrededor de contratos.** Las herramientas cambian, las APIs cambian, las empresas desaparecen — lo permanente es la interfaz. Los proveedores (Arturito, Gmail, Meta, un CRM…) son **drivers** intercambiables detrás de un contrato estable, igual que un SO define una interfaz y cualquier dispositivo compatible se conecta. **VERA Brain NUNCA conoce a Arturito ni a ningún proveedor concreto; sólo conoce contratos.**
- **Investigación Arturito (2026-07)**: plataforma CERRADA. Sin API pública, sin webhooks a terceros, sin docs de desarrollador (verificado: no existen `api./docs./developers.` ni paths públicos; `app.arturito.ai` 307). Es el DESTINO de integraciones (importa desde tu CRM/catálogo vía TokoBroker), no una fuente. → VERA no se ata a Arturito.
- **Nuevo contrato `ConversationProvider`** (`/app/backend/conversations/`): capa de dominio vendor-agnóstica. `types.py` (modelo canónico `Conversation`/`Contact`/`ConversationMessage`, con channel/lead_status/tags); `provider.py` (ABC `ConversationProvider` con `list_conversations`/`get_conversation`/`find_by_phone` + `MockConversationProvider` como STAND-IN temporal de datos de ejemplo + `active_conversation_provider` = punto ÚNICO de acoplamiento). Drivers futuros: `ArturitoProvider`, `WhatsAppCloudProvider`, `KommoProvider`, `HubSpotProvider`, `TokkoProvider`, `EasyBrokerProvider`.
- **Refactor**: el Insights Engine (`FollowUpRule`, `engine`, `routes_insights`) ahora consume `active_conversation_provider` (async, modelo de dominio) en vez del viejo `insights_engine/repository.py` (ELIMINADO). Fuente única de conversaciones para todo el sistema.
- **Knowledge Hub**: `InsightsKnowledgeSource` → renombrada a **`ConversationKnowledgeSource`** (consume el contrato, no un proveedor). Sigue cerrando el círculo AI-First (VERA sabe quién es cada contacto, qué preguntó, por qué es oportunidad; ahora también el canal). 3 fuentes: vera, properties, conversations.
- **Doc `/app/docs/PROVIDERS.md`**: filosofía de drivers + catálogo de contratos de plataforma (AIProvider, KnowledgeSource, ConversationProvider, MessagingProvider, StorageProvider, PropertyProvider-futuro). Agregada a `DOC_ORDER` de `VeraKnowledgeSource` → VERA conoce su propia arquitectura de desacople.
- **Verificado (curl)**: `/api/brain/sources` = 3 fuentes; `/api/insights` = 3 oportunidades + 5 conversaciones activas (comportamiento idéntico pre/post refactor); `/api/brain/ask` sobre Sofía → VERA responde con canal Instagram + contexto. Backend sano. Refactor 100% backend, transparente para el frontend.
- **Pendiente del usuario**: contactar a Arturito para saber si ofrecen API privada / partner / webhooks / export. Si existe integración oficial → `ArturitoProvider`; si no → otro driver. La arquitectura NO depende de esa decisión.


Primer paso de consolidación del Knowledge Hub pedido por el usuario: **conectar los insights del día al contexto de VERA Brain**. Ahora, cuando en el Spotlight se toca "Seguir con Sofía", VERA ya sabe quién es, qué preguntó y por qué es una oportunidad — Hoy ↔ Spotlight ↔ VERA Brain como un solo circuito. Verificado por curl (VERA describe a Sofía: PH a estrenar, envió documentación, 3 días sin respuesta → oportunidad alta + mensaje sugerido; con honestidad aclara que el PH no está en la cartera real) + E2E (chips "Seguir con {nombre}" disparan la conversación). `tsc` limpio.
- **Backend** `vera_brain/knowledge.py`: nueva `InsightsKnowledgeSource` (id `insights`) registrada en el Hub (orden = permanencia: VERA → cartera → día). `fetch()` (import diferido, sin ciclos) arma: conversaciones activas (contacto, propiedad, teléfono y "qué dijo" el cliente) + oportunidades/insights del `engine.detect()` con tipo/prioridad/motivo/señales. `GET /api/brain/sources` ahora lista 3 fuentes.
- **Frontend** `SpotlightModal.tsx`: sugerencias de oportunidad ahora "Seguir con {primer nombre}" y la pregunta pide contexto + mensaje ("¿Cómo sigo con {nombre}? Contame qué preguntó, por qué es una oportunidad y sugerime un mensaje.").
- **MOCKED**: las conversaciones siguen siendo de ejemplo; al conectar Arturito, la misma fuente del Hub se alimenta de datos reales sin tocar VERA Brain ni la UI.


Cambio de modelo mental pedido por el usuario: VERA no es un dashboard pasivo de widgets ni un "CRM con IA". El usuario abre la app y siente que **VERA ya trabajó por él mientras no estaba**. Criterio de aceptación del usuario: "¿da la sensación de que hay una inteligencia trabajando para mí?". Verificado E2E por screenshots (login→Hoy→Spotlight→respuesta real de VERA→Vera Bot); `tsc --noEmit` limpio.
- **TodayHero** (`app/workspace/TodayHero.tsx`) = la VOZ de VERA, protagonista de "Hoy" (movido al tope de `WorkspaceHome`, por encima del launcher del Spotlight). Aura ambiental que respira, orbe VERA con pulso, saludo grande (clamp 2.1–3.2rem), "Mientras no estabas revisé todo. Esto es lo que encontré:" con hallazgos REALES del Insights Engine (`summary.by_type` + `active_conversations`) y CTA "Ver qué preparé para vos" → abre Spotlight. CSS `.vera-hero*` nuevo (antes el componente existía sin estilos).
- **SpotlightModal** (`app/workspace/SpotlightModal.tsx`) reescrito PROACTIVO: ya no es un buscador. Al abrir, VERA **inicia** la conversación con un mensaje compuesto localmente desde los insights reales ("encontré 3 oportunidades comerciales y 5 conversaciones activas. ¿Por dónde querés empezar?") + **sugerencias dinámicas** derivadas de los insights del día (personas/títulos reales, no ejemplos estáticos). El input pasó al PIE como composer de chat. Cabecera con identidad VERA (orbe + "Tu inteligencia de trabajo"). Sigue delegando a `veraBrain.ask()`/`today()`; respuestas honestas (no inventa). CSS `.vera-spot__header/identity/orb/suggest/chip`.
- **VeraBotWorkspace** (`app/vera-bot/VeraBotWorkspace.tsx`): jerarquía reforzada. Bloque PROTAGONISTA "La inteligencia / VERA orquesta tu comunicación" (tarjeta amarilla, orbe grande, 3 puntos de lo que hace VERA) → conector "ejecuta la mensajería a través de" → bloque SUBORDINADO "Motor conectado · Arturito" (discreto, glass, botón secundario, canales adentro). Comunica: VERA orquesta la inteligencia; Arturito sólo ejecuta la mensajería. CSS `.vera-bot__eyebrow/vera*/wire*/engine*`.
- Nota: los datos de conversaciones/insights siguen **MOCKED** (hasta conectar Arturito); VERA Brain conoce docs + cartera real de propiedades, por eso al preguntar por un contacto mockeado responde honestamente que no lo tiene registrado.



## VERA Brain — Insights: "Revisar mensaje" (WhatsApp) (2026-07)
Sobre los insights de tipo oportunidad, el botón "Copiar" se reemplazó por **"Revisar mensaje"** → abre un modal con el mensaje generado **editable** (VERA propone; el usuario siempre puede corregir antes de enviar).
- `app/insights/ReviewMessageModal.tsx`: textarea editable prellenada + **Copiar** + **Abrir en WhatsApp** (`wa.me/{phone}?text=` con el texto EDITADO; sin teléfono → `wa.me/?text=`). Nada se envía automáticamente.
- `InsightCard`: para `type==='opportunity'` muestra "Ver conversación" + "Revisar mensaje"; el resto mantiene link + copiar.
- Backend: mock de conversaciones ahora incluye `phone`; `FollowUpRule` lo pasa en `meta.contact_phone`.
- CSS `.vera-review*`. Verificado E2E: modal abre con mensaje, edición, y WhatsApp con texto editado + teléfono (`api.whatsapp.com/send/?phone=549...&text=...`). TS strict OK.

## VERA Brain — Fase 2.1: Insights Engine + PropertiesKnowledgeSource (2026-07)
Generalización pedida por el usuario: **Opportunity Engine → Insights Engine**. Las oportunidades son sólo UN tipo de insight (types: opportunity, risk, recommendation, priority, reminder, task). Sumar capacidad = registrar una regla; el motor no cambia. Filosofía intacta: las REGLAS detectan hechos (sin IA), VERA Brain organiza contexto, Claude aporta criterio; VERA propone · el usuario decide.
- **Backend** `insights_engine/` (reemplaza `opportunity_engine/`): `types.Insight` (id, type, category, priority, title, reason, suggested_action, action_label, link_route/label, signals, meta). `rules.InsightRule` (ABC async) + `FollowUpRule` (→ opportunity, señales de interés configurables, 48h) + `PropertyHealthRule` (→ recommendation/priority sobre datos REALES: propiedades activas sin fotos / sin publicar). `engine.RuleBasedInsightsEngine` (async, ordena por prioridad+tipo). `routes_insights.py` → `GET /api/insights`.
- **Knowledge Hub** ahora async y con 2 fuentes: `VeraKnowledgeSource` + **`PropertiesKnowledgeSource`** (cartera real de Supabase). Verificado: VERA Brain conoce la cartera real (1 casa activa, USD 79.000, 2 publicaciones, 8 fotos). `vera_brain/brain.py` `_system()` ahora async.
- **Frontend** `app/insights/` (reemplaza `app/opportunities/`): `Insight` type, `useInsights`, `InsightCard` (dot y acento por tipo, badge de tipo, prioridad, señales, acción sugerida, botones Ver/Copiar con fallback), `InsightsSection` ("VERA Insights"). Montado en `WorkspaceHome` entre Acciones Rápidas y widgets. CSS `.vera-ins*` con colores por tipo (opportunity verde, risk naranja, recommendation azul, priority violeta, reminder teal).
- Verificado: `GET /api/insights` → 3 opportunities (Sofía/Juan alta, María media); PropertyHealthRule no dispara con cartera sana (honesto); UI con tablero tipado (screenshot). TS strict OK. **MOCKED**: conversaciones de ejemplo hasta conectar Arturito.
- **Roadmap Insights** (arquitectura lista): nuevas propiedades compatibles, vendedores sin seguimiento, publicaciones con bajo rendimiento, propietarios esperando tasación, tareas pendientes.
- **App Personas** (a diseñar): pensar el modelo desde la PERSONA (agrupa conversaciones, propiedades, visitas, tareas, oportunidades, historial, campañas, notas); la conversación es sólo un elemento.

## VERA Brain — Fase 2: Opportunity Engine (Follow-up inteligente) (2026-07)
Primer módulo de **inteligencia comercial**. Principio: VERA detecta y SUGIERE; el humano decide y aprueba. **Nunca envía mensajes automáticamente.** No es un CRM ni automatización invasiva.

**Backend** (`/app/backend/opportunity_engine/`), desacoplado del proveedor de IA:
- `types.py` — modelo `Opportunity` {type, priority, reason, suggested_message, contact_id, contact_name, conversation_id, hours_since_last, signals}.
- `rules.py` — `OpportunityRule` (ABC) + `FollowUpRule`. Clasificación de interés **BASADA EN REGLAS (sin IA)**, transparente y configurable: `INTEREST_SIGNALS` (pidió visita=3, precio=2, financiación=2, documentación=2, ubicación/nombre/teléfono=1), `INTEREST_THRESHOLD=2`, `FOLLOW_UP_HOURS=48`. Si interés ≥ umbral y ≥48h de silencio → FOLLOW_UP_SUGGESTED. Mensaje sugerido por template (nunca se envía).
- `repository.py` — `ConversationRepository` (ABC) + `MockConversationRepository` (DATOS DE EJEMPLO — Arturito/WhatsApp aún no dan datos reales; se enchufa la fuente real sin tocar el motor). `conversation_repository` = punto de acoplamiento de la fuente.
- `engine.py` — `OpportunityEngine` (ABC) + `RuleBasedOpportunityEngine` (corre reglas, ordena por prioridad). `engine` activo; sumar capacidades = registrar más reglas.
- `routes_opportunities.py` — `GET /api/opportunities`. Registrado en `server.py`.

**Frontend** (`app/opportunities/`): `types.ts`, `useOpportunities.ts` (react-query), `OpportunityCard.tsx` (dot por prioridad, "Seguimiento sugerido", inactividad, reason, chips de señales, mensaje sugerido, botones **Ver conversación** → /vera-bot y **Copiar mensaje sugerido** con fallback execCommand), `OpportunitiesSection.tsx` (montada en `WorkspaceHome` entre Acciones Rápidas y widgets), `index.ts`.

**Verificado**: `GET /api/opportunities` → 3 oportunidades (Sofía/Juan high, María medium); Carlos (solo "hola") y Lucía (reciente 3h) correctamente excluidos. UI en Hoy con 3 tarjetas (screenshot). TS strict OK. **MOCKED**: los datos de conversación son de ejemplo hasta conectar Arturito real.

**Roadmap del Opportunity Engine** (arquitectura lista, no implementado): nuevas propiedades compatibles, vendedores sin seguimiento, publicaciones con bajo rendimiento, propietarios esperando tasación, tareas pendientes.

## VERA Brain — Claude como inteligencia central (Fase 0 + Fase 1) (2026-07)
Cambio conceptual del usuario: **VERA no construye inteligencia; construye el mejor workspace y delega el razonamiento a Claude.** VERA = Workspace + UX + Apps + Integraciones. Claude = cerebro (INTERNO e invisible). Principio inquebrantable: **el usuario SIEMPRE habla con VERA, nunca con Claude.**
Regla de producto permanente: antes de cada feature → *¿esta lógica debe vivir en VERA o puede resolverla VERA Brain con el contexto disponible?* Si Claude puede, no se desarrolla lógica específica.

**Backend** (`/app/backend/vera_brain/`):
- `ai_provider.py` — `AIProvider` (ABC, DETALLE INTERNO) + `ClaudeProvider` (emergentintegrations `LlmChat`, `anthropic`/`claude-sonnet-4-6`, `EMERGENT_LLM_KEY`). `active_provider` = único punto de acoplamiento del proveedor (cambiar modelo = 1 línea).
- `knowledge.py` — `KnowledgeSource` (ABC) + `VeraKnowledgeSource` (carga `/app/docs/*.md` + `PRD.md`) + **`KnowledgeHub`** (repositorio único; las fuentes lo alimentan, VERA Brain lo consulta, NO las integraciones directamente). MVP: sólo VeraKnowledgeSource registrada.
- `memory.py` — **capa Memory**: conocimiento propio de VERA en el tiempo (preferencias, decisiones, patrones). Persistencia simple en `vera_memory.json`. `remember/recall/as_context`.
- `brain.py` — `VeraBrain` orquestador: arma system (IDENTITY blindada + Knowledge Hub + Memory) → delega a `active_provider`. `ask(question, session_id)` y `today_briefing()`.
- `routes_brain.py` — `POST /api/brain/ask`, `GET /api/brain/today`, `GET /api/brain/sources`, `POST /api/brain/remember`. Registrado en `server.py`.

**Frontend**:
- `app/brain/brain-gateway.ts` — `veraBrain.ask()/today()` (único contacto del front con la inteligencia; nunca conoce el modelo).
- `SpotlightModal.tsx` reescrito = **Vera Expert**: chat real "Preguntale a VERA", botón "¿Qué pasó hoy?", sugerencias, burbujas usuario/VERA, indicador de tipeo. CSS `.vera-spot__*` (send, today, thread, msg, typing).

**Verificado**: `/ask` responde con filosofía de VERA; `/today` da resumen honesto (sin inventar cifras, menciona integraciones pendientes); identidad blindada (a "¿sos Claude?" responde "soy la inteligencia de VERA, no soy Claude/GPT/Gemini"); UI del Spotlight con flujo completo (screenshot).

**Pendiente / próximas fases**:
- Fase 2: migrar `ai_content_service.py` (hoy atado a Gemini) para que consuma `AIProvider`.
- Fase 3: nuevos Knowledge Sources reales (PropertiesKnowledgeSource, luego Gmail/Meta/Arturito al activar OAuth) — se registran en el Hub sin tocar VERA Brain.
- Streaming SSE en `/ask` (hoy single-turn no-streaming); historial conversacional persistente; `DESIGN_SYSTEM.md`/`BRAND.md` como fuentes de conocimiento permanente.
- Evaluar migrar de Emergent Key a cuenta propia de Anthropic (trivial: cambiar provider).

## Sprint 05.1 — Acciones Rápidas en Hoy + principio de fuente única (2026-07)
Principio arquitectónico del usuario: **toda integración tiene una ÚNICA fuente de configuración; ninguna App guarda datos de conexión propios.** Las Apps consumen; si falta config, guían a configurarla (nunca la duplican).
- **Acciones Rápidas** (`app/workspace/QuickActions.tsx`): bloque dedicado en Hoy, debajo del encabezado y arriba de los widgets (centro de operaciones). Botones grandes con ícono/logo oficial. Filosofía "acciones, no accesos".
- **Catálogo** `quick-actions-catalog.ts`: `kind: 'site' | 'integration' | 'route'`. Default fijadas (6): Abrir Sitio Web, Arturito, Gmail, Dropbox, Nueva Propiedad (→/propiedades/nueva), Studio (→/studio). Extra disponibles: Responder WhatsApp (integration), Generar publicación (→/studio).
- **Personalización** `useQuickActions.ts`: fijar/quitar + restablecer, persistido `vera:quickactions:{email}`. Reorden por drag = futuro.
- **Fuente única**: la config de dominios del Sitio Web vive SOLO en Integraciones. `useIntegrations` ahora gestiona `SiteConfig {domains, primary}` (helpers `addDomain/removeDomain/setPrimaryDomain/primarySiteUrl`), persistido en `vera:integrations:{email}` bajo la clave `web`. Modal `SiteDomainsModal.tsx` (agregar/quitar/elegir principal), abierto desde la tarjeta "Sitio Web" (`configurable`). `IntegrationCard` muestra dominio principal + conteo.
- **Hoy consume, no duplica**: "Abrir Sitio Web" lee `primarySiteUrl()` de Integraciones (mismo localStorage) → abre el principal; si no hay ninguno, navega a `/integraciones` para configurarlo. Acciones de integración (Gmail/Dropbox/Arturito/WhatsApp) toman su URL del catálogo de Integraciones (fuente única de la URL del servicio).
- CSS `.vera-qa*` y `.vera-site-modal*`/`.vera-site-domain*`. Verificado E2E: render, guía-a-config sin dominio, alta de 2 dominios + principal (persistido), consumo desde Hoy sin duplicar, personalizar (pin WhatsApp).
- **Pendiente futuro**: aplicar el mismo principio de fuente única a URLs del Dock (`apps-catalog.ts` aún define sus hrefs); reorden por drag; OAuth real.

## Sprint 05 — Centro de Integraciones (2026-07)
Nueva App **"Integraciones"** (Sidebar, flag `integraciones: true`, ruta `/integraciones` en `VeraOS.tsx`). Es el hub donde el profesional arma su ecosistema — "VERA orquesta, no reemplaza".
- **Backend** `routes_integrations.py` → `GET /api/integrations/{provider}/health`: health-check REAL de alcance (httpx GET a `app.arturito.ai`, follow_redirects, timeout 6s). Devuelve `{provider, status: operational|degraded|down, http_status, latency_ms, checked_at}`. Solo `arturito` soportado (HEALTH_TARGETS); el resto → 404. Semántica: "servicio operativo", NO "cuenta conectada". Registrado en `server.py`.
- **Frontend** `app/integraciones/`: `types.ts`, `catalog.ts` (12 integraciones en 6 categorías: Mensajería, Correo, Almacenamiento, IA, Publicación, Presencia), `useIntegrations.ts` (estado conectar/desconectar SIMULADO, persistido en `localStorage` `vera:integrations:{email}`; Arturito `defaultConnected`), `useIntegrationHealth` (react-query, refetch 60s, solo `healthMode:'real'` && conectado), `IntegrationCard.tsx`, `PreferencesPanel.tsx`, `IntegrationsScreen.tsx` (tabs Integraciones/Preferencias), `index.ts`.
- **Tarjetas**: logo oficial a color (BrandIcon, Arturito/ML full-color), estado Conectado/No conectado, última sync (relativa), health badge (Operativo·latencia / Inestable / Sin respuesta) solo para Arturito, botones Conectar | Configurar (abre web) | Desconectar. Contador global `X/12 conectadas`.
- **Preferencias**: identidad (nombre/firma de WorkspaceConfig) + apariencia (tema oscuro activo, swatch de acento) — solo lectura, edición "próximamente".
- CSS `.vera-int*` / `.vera-int-card*` / `.vera-prefs*` en `index.css`. Verificado E2E: health real (operational, latencia), conectar→2/12, persistencia tras reload, desconectar→1/12.
- **Pendiente futuro**: OAuth real por integración (Gmail/Drive/Meta) para reemplazar el estado simulado; secciones Cuentas/IA/Automatizaciones/Seguridad; editar identidad/tema desde Preferencias.

## Sprint 04.1 — Logos oficiales de herramientas integradas (2026-07)
Dirección confirmada por el usuario: **mantener logos oficiales A COLOR** (no monocromáticos). La consistencia la aporta el sistema de diseño de VERA (contenedores, tamaños, espaciado, animaciones, estados); cada integración conserva su identidad de marca para comunicar que VERA integra (no reemplaza).
- **Logo oficial de Arturito**: descargado de `arturito.ai/images/icons/arturito-icon.png` (tile navy con glifo "a" en degradado + globo naranja) → `/public/brands/arturito.png` (180×180 RGBA). Clave `arturito` agregada al `BrandRegistry` (tipo + array).
- **Íconos full-color**: `BrandIcon` con `mono={false}` NO tiñe ni blanquea (renderiza el PNG tal cual). Se agregó `fullColor?: boolean` a `DockTool` (apps-catalog) y `brandFullColor: boolean` a `MessagingProvider`; ambos true para Arturito/Canva. El Dock y la tarjeta de Vera Bot pasan `mono={!fullColor}`.
- **Arturito en el Dock**: agregado a `apps-catalog.ts` (primera posición, href `app.arturito.ai`) y a `DEFAULT` de `useDock.ts` → visible por defecto.
- **Fix Canva**: `canvas.png` existente era en realidad el logo de *Canvas LMS* (no Canva). Se bajó el ícono oficial de Canva (`static.canva.com` favicon → `/public/brands/canva.png`, círculo degradado teal→violeta con "C"). `canva` marcado `fullColor`.
- Verificado por screenshots: tarjeta Vera Bot muestra logo Arturito (naturalWidth 180); Dock muestra Arturito primero + resto a color.
- Pendiente: logos oficiales opcionales para Dropbox ya OK; considerar limpiar `canvas.png` si no se usa Canvas LMS.

## QA Migración CRM Legacy — VERIFICADO E2E (2026-07)
Corrida real del flujo completo end-to-end (exportar → importar → mapear → imágenes → cartera lista) + QA. Verificado por curl (corrida 5ª) + screenshot (login QA → /propiedades, 24 tarjetas con imágenes).
- **Flujo completo OK**: `GET /api/export/properties` (23) → `POST /api/migration/import-legacy` (job) → mapeo explícito LegacyProperty→Property → descarga/re-subida de imágenes a Storage propio.
- **Idempotencia confirmada**: reimportar dio **23 actualizadas, 0 creadas, 0 duplicados, 0 errores**; media SALTADA (ya existía, no re-duplica).
- **Estado de la cartera**: 24 propiedades totales (1 original + 23 legacy), sin duplicados por título; 76 imágenes + 5 documentos en Supabase Storage; portadas cargan (Signed URL HTTP 200); precio/moneda/ubicación/specs mapeados bien.
- **Observaciones esperadas (no bugs)**: (1) fotos aleatorias de picsum porque el exportador Legacy es SIMULADO (con CRM real llegarían fotos reales; el flujo de descarga/re-subida ya está probado). (2) `legacy_column: False` — la columna `legacy_id` no existe en la tabla Supabase; idempotencia 100% en Mongo (23 mapeos + 5 logs). Opcional: `ALTER TABLE properties ADD COLUMN IF NOT EXISTS legacy_id text;` (el importador ya lo detecta y persiste solo).

## Fix "Hoy" (solo Insights, sin listar propiedades) + investigación CRM real (2026-07-20)
Dos pedidos del usuario. Verificado por curl + screenshot.
- **Fix "Hoy"**: el dashboard dejó de generar **una tarjeta por propiedad activa**. Backend `insights_engine/rules.py` → `PropertyHealthRule` ahora **AGREGA** ("N propiedades sin publicar" [priority/high], "N propiedades sin fotos" [recommendation/medium]) en insights únicos, en vez de 1 por propiedad. `/api/insights` bajó de **64 → 4** insights (1 agregado + 3 seguimientos por persona de `FollowUpRule`). Frontend: "Hoy" pasa a **fuente única** = VERA Insights (backend). Se eliminó el motor frontend paralelo que mapeaba propiedad-por-propiedad: borrados `useToday.ts`, `packages/services/intelligence/*` (5 archivos), `packages/types/intelligence.ts`; limpiados barrels (`services/index.ts`, `types/index.ts`) y `service-container.ts`. `PrioridadesWidget` (`widgets.tsx`) ahora consume `useInsights()` (top insight). `TodayHero` label "priority" → "asunto(s) prioritario(s)". `tsc` limpio.
- **Investigación importador (Task 1)**: el botón "Importar desde CRM Legacy" **NO** está conectado a un CRM real → usa `legacy_crm/exporter.py` (SIMULADO, 23 props ficticias + imágenes picsum). `LEGACY_EXPORT_URL` = localhost.
- **Hallazgo — datos duplicados**: `properties` en Supabase tiene ~62 filas (23 títulos duplicados) por corridas repetidas de la migración simulada desde **preview + producción** (comparten Supabase pero tienen Mongos de idempotencia separados; `legacy_id` no existe en la tabla → sin idempotencia global). Pendiente de decisión del usuario: limpiar duplicados + conectar CRM real + `ALTER TABLE ... legacy_id`.
- **CRM real identificado**: repo GitHub `viejoskill/varela-propiedades` (app HTML estática que habla directo con Supabase client-side; sin migraciones SQL en el repo). Documentado el esquema completo en **`/app/docs/CRM_DATA_MODEL.md`** (21 tablas: propiedades, propietarios, contactos, visitas, autorizaciones, documentos_firma, mensajes_wa, etc. + bucket `fotos-propiedades`), con columnas reconstruidas del código, relaciones y mapeo explícito a VERA. Bloqueante de precisión antes de migrar: confirmar tipos/enums/NOT NULL con `SERVICE_ROLE_KEY` del CRM o un `pg_dump --schema-only`.

## Sprint "Cartera real (CRM Varela) — VERA como fuente de verdad" (2026-07-20)
Se reemplazó la migración simulada por la **importación de la cartera REAL** desde el CRM Varela. Verificado E2E (curl polling + screenshot: 28 tarjetas con fotos/precios/estados reales, 0 duplicados).
- **Fuente real**: el CRM (`github.com/viejoskill/varela-propiedades`) es una app client-side; su `SUPABASE_URL` + key **anon** son públicas (en `crm.html`). El importador LEE `propiedades` por PostgREST (solo lectura). Credenciales en `backend/.env`: `CRM_SUPABASE_URL`, `CRM_SUPABASE_KEY` (proyecto `fwwzjynerfghqsakkyvq`). Driver `legacy_import/crm_source.py` (contrato async → list[dict]).
- **Importador reescrito** (`legacy_import/importer.py`): mapeo EXPLÍCITO del esquema real → VERA (normaliza tipo/operación/estado; `_to_int` para dormitorios string; `currency='USD'`; `owner_observations` = nombre+tel del propietario; `condition` ← antigüedad; publications ← flags publicado_web/ml/zp). Descarga las `fotos[]` (URLs externas: Google Storage + Supabase del CRM) y las re-sube al Storage propio (portada = índice 0). **28 propiedades reales, 312 imágenes, 0 errores.**
- **Idempotencia**: por `legacy_id` (= `id` del CRM) + código comercial `codigo` (VAR-xxxxx). El importador **auto-detecta** si existen las columnas `legacy_id`/`codigo` y las persiste; si no, cae al mapa Mongo (idempotencia sigue funcionando) y `code` usa el fallback derivado del id. Serializer: `code = codigo || _property_code(id)`.
- **Reset**: `POST /api/migration/reset?confirm=BORRAR-TODO` borra todas las propiedades + objetos de Storage + mapa Mongo. Se ejecutó (borró las 62 propiedades fake) y luego se importaron las 28 reales.
- **Limpieza**: eliminado el exportador simulado `legacy_crm/` (y su montaje en `server.py`) + `LEGACY_EXPORT_URL`. Botón/Modal renombrados "Importar desde **CRM Varela**".
- **PENDIENTE (DDL del usuario)**: RESUELTO 2026-07-20 — el usuario corrió el `ALTER TABLE`. Se re-importó (0 creadas, 28 actualizadas, sin re-bajar fotos): las 28 quedaron con `legacy_id` (id del CRM) y `codigo` real (VAR-432272, VAR-208954…) poblados. Idempotencia global activa. Las tarjetas muestran el código comercial real. Estado final: **workspace = solo cartera real (28), 0 fake, 0 duplicados; "Hoy" sin ruido de propiedades**.

## Sprint "Property Workspace v1.0" (2026-07-20)
Reestructuración de la ficha al flujo natural inmobiliario + base de la App Personas (tabla `people`).
- **Nuevo orden**: Datos → Fotos → Propietario → Documentos → Comercialización → Publicaciones → Estadísticas (`PropertyWorkspace.tsx` reescrito).
- **Título eliminado** del form de Datos (es contenido de Studio; sigue existiendo como dato mostrado). `form-schema` title sin validación; `BasicInfoSection` sin input de título.
- **Barra de estado** en el encabezado (Disponible/Reservada/Vendida/Archivada, 1 clic) + **código comercial VAR-xxxxx** visible. Clases `--st-*` para color (evita colisión con `--active`).
- **Propietario = App Personas (backend real)**: tabla `people` (id, workspace_id, full_name, phone, email, notes, roles jsonb, created_at); `owner_id` de properties → people.id. Backend: `people/repository.py`, `routes_people.py` (GET list?role=, POST, GET/{id}, PATCH), schemas Person*. Frontend: `Person` type, `ApiPeopleGateway`, `PeopleService` (wired en service-container), `usePeople` (useOwners/useCreatePerson), `NewPersonModal` (crea Persona real sin salir de la ficha → auto-asocia → selector se refresca solo vía react-query).
- **Comercialización** (`CommercializationSection`): solo muestra estado del contenido (Nunca generado/Generado/Desactualizado) + botón "Abrir en Studio" (`/studio?property=`). NO genera publicaciones (eso es Studio). Se quitó `ExpressSection` del workspace.
- **Publicaciones** (`ChannelsSection`): sección propia; catálogo suma Instagram + Facebook ("Próximamente") junto a Web Varela + Mercado Libre (operativos), Zonaprop/Argenprop (próximamente).
- **Estadísticas** (`StatsSection`): métricas solo lectura — Visitas reales + Consultas/Favoritos/Conversión/Rendimiento/Insights ("Próximamente"). TrackingSection (visitas) queda bajo Estadísticas.
- **DDL RESUELTO 2026-07-20**: el usuario creó la tabla `people`. Flujo verificado E2E por testing agent (100% de criterios): orden de secciones, código VAR en encabezado, barra de estado 1 clic (persiste tras F5), Título eliminado, modal "+ Nuevo propietario" crea Persona real y auto-asocia sin recargar, Comercialización→Studio, Publicaciones con IG/FB "Próximamente", Estadísticas con Visitas reales. Hallazgo LOW (delay de resaltado del botón de estado) corregido con optimistic update (`queryClient.setQueryData(['property', id], ...)`) en `changeStatus`. Personas de prueba borradas → tabla `people` limpia para propietarios reales.

## Sprint "Publicaciones + Sitio Web público (VERA fuente única)" (2026-07-20)
El "Sitio Web" pasa a ser una **vista pública de VERA que lee EN VIVO** la cartera (sin sync ni duplicación, sin escribir al CRM viejo). Verificado E2E (curl + screenshots).
- **Backend público** (`routes_public.py`, montado en server.py): `GET /api/public/listings` (activas + publicadas en canal `web-varela`, no archivadas) y `GET /api/public/listings/{id}` (404 si no cumple). Sin auth, sin datos privados (dropea ownerId/ownerObservations/publications/documents). Reusa serializers (signed URLs).
- **NO requiere columna nueva**: el estado "publicado en web" vive en el jsonb `publications['web-varela'].status`. "Publicar en Web" = botón Publicar del canal web (ya existente).
- **Vista pública** (fuera de RequireAuth): rutas `/web` (grilla `PublicListing.tsx`) y `/web/:id` (`PublicPropertyDetail.tsx` con galería). Marca "VARELA PROPIEDADES", tema oscuro, responsive. CSS `vera-pub*` en index.css.
- **Automatización inherente**: al marcar Vendida/Archivada la propiedad **desaparece sola** de la web (la query pública exige status=='active' y no archivada). Precio/fotos/descripción/portada se reflejan solos porque se leen en cada request. Verificado: prop sold → 404; listings excluye no-activas (23 de 28 visibles).
- **Panel de Publicaciones** (`ChannelsSection`): Web Varela + Mercado Libre operativos con Estado/última sync/URL/Publicar/Actualizar/Despublicar; Zonaprop/Argenprop/Instagram/Facebook "Próximamente". El canal Web muestra link automático **"Ver en la web"** → `/web/{id}` (no requiere pegar URL).
- **Mercado Libre**: queda como **panel controlado** (operado manualmente: publicar/actualizar/despublicar + ML link/estado). La API real de ML (OAuth publish automático, ML ID, detección de errores) queda PENDIENTE de credenciales del usuario (app de developers.mercadolibre.com Client ID/Secret + cuenta vendedor) → usar integration_expert cuando las provea.

## Ajuste web pública: filtros + mostrar Vendidas/Reservadas con sello (2026-07-20)
- **Cambio de criterio**: la web ya NO oculta Vendidas/Reservadas. Muestra TODAS las publicadas en web (active+reserved+sold, no archivadas) con **sello** VENDIDA (amarillo) / RESERVADA (rojo) para transmitir "Varela vende" y atraer leads de propietarios vendedores. Backend `routes_public.py`: `_PUBLIC_STATUSES={active,reserved,sold}`, lista con `list_properties(status="all")` filtrando por `_web_published`; summary incluye `status`. Detalle también accesible para reserved/sold.
- **Filtros públicos** en `/web` (`PublicListing.tsx`): Tipo, Zona (neighborhood/city dedupe), Precio máximo (steps), Ambientes (min) + Limpiar; contador "N propiedades encontradas" (filtrado client-side, 28 items). Sellos en tarjeta y en ficha (`vera-pub-stamp*`). Verificado por screenshot (28 tarjetas, 5 sellos, filtro tipo=terreno→9).

## Fix: Comercialización inline (título + descripción con IA) — 2026-07-20
- **Bug del usuario (carga)**: la sección "Comercialización" mandaba todo a Studio (App "Próximamente", no construida) vía `CommercializationSection` + botón "Abrir en Studio". Como el campo Título ya no estaba en el form y la generación de contenido vivía solo en Studio, el usuario quedaba SIN forma de poner título/descripción; y al navegar a Studio (o volver atrás) en una propiedad nueva sin guardar, se perdía lo cargado (estado RHF en memoria).
- **Fix**: se reemplazó `CommercializationSection` por `ExpressSection` INLINE en el Workspace (`PropertyWorkspace.tsx`, panel "Comercialización"). Ahora dentro del Workspace: campo **Título manual** (nuevo `Input` bindeado a `title` en `ExpressSection.tsx`), **"Generar publicación completa"** (IA `/api/ai/express`: título + descripción + destacados + textos ML/Zonaprop), **"Editar descripción a mano"** (Textarea). No requiere navegar a Studio → no se pierde lo cargado en el flujo normal.
- Verificado: `tsc` limpio, `/api/ai/express` responde OK (curl), screenshot del Workspace (`/propiedades/nueva`) mostrando el campo Título + botón Generar + editar descripción.
- **Pendiente/nota**: sigue existiendo pérdida de datos si el usuario aprieta la flecha "Volver" en una propiedad nueva sin guardar (comportamiento estándar de form no persistido). Mejora ofrecida al usuario: guard de "cambios sin guardar". `studioService` quedó importado sin uso en `PropertyWorkspace.tsx` (inocuo).
- Swap mocks in `src/packages/services/service-container.ts` (single wiring point).
- New App = new screen + feature-flag flip in `@vera/config` + route in `VeraOS.tsx`.
- All visual values come from `@vera/design-tokens`; never hardcode.
