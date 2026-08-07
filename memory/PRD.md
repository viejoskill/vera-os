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

## Sprint "Borrador + Aviso de salida + Personas multi-rol" — 2026-07-20
3 features pedidas por el usuario para cargar propiedades sin perder trabajo. Verificado 100% (iteration_25): frontend 4/4 flujos, sin bugs; backend por curl (personas multi-rol + propiedad draft create/list). tsc limpio.
- **Guardar borrador**: botón "Guardar borrador" (`workspace-save-draft`) en el header del Workspace, visible en propiedad nueva o borrador (`canDraft = isNew || detail.status==='draft'`). Persiste SIN validar (`getValues()` + `buildPayload(v,'draft')`), status `draft`. Nueva → crea draft y navega a `/propiedades/{id}`; existente draft → update. "Guardar" (validado) PROMUEVE un draft a `active`. Nuevo estado `draft` en `PropertyStatus`, filtro "Borradores" (`filter-draft`) + badge `.vera-badge--draft` en `PropertiesScreen`. Columna `status` es text libre en Supabase (sin migración).
- **Aviso de cambios sin guardar**: al tocar Volver (`workspace-cancel`) con `form.formState.isDirty` en propiedad nueva/borrador → modal (`leave-confirm`) con "Guardar borrador y salir" (`leave-save-draft`), "Salir sin guardar" (`leave-discard`), "Seguir editando" (`leave-keep`). También `beforeunload`. Sin cambios → navega directo.
- **Personas multi-rol**: `NewPersonModal` con selector de Roles (5 chips `role-{propietario|vendedor|comprador|inquilino|contacto}`), props `title`/`defaultRoles`. `OwnerSection` muestra roles como tags (`owner-roles`, `PERSON_ROLE_LABELS`). Backend `people` ya soportaba `roles: string[]`. Nuevos exports en `@vera/types/person.ts`: `PERSON_ROLES`, `PERSON_ROLE_LABELS`.
- Nota: el guard de salida solo aplica a propiedad nueva/borrador (alcance). ML OAuth real lo hace el usuario (conectar su cuenta vendedor).

## Disclaimer legal de imágenes IA (auto) — 2026-07-20
Opción A (solo en publicaciones, sin tocar la descripción editable): se agrega automáticamente el disclaimer de imágenes optimizadas por IA al final de la descripción en cada publicación.
- **Web pública** (`PublicPropertyDetail.tsx`): párrafo `.vera-pub-detail__disclaimer` (fuente menor 0.78rem + cursiva + muted, `#8a8a8f`), siempre al final de la sección Descripción (se muestra aunque no haya descripción). data-testid `public-detail-disclaimer`. Texto en constante `AI_IMAGE_DISCLAIMER`.
- **Mercado Libre** (`mercadolibre/service.py`): `_description_with_disclaimer(prop)` agrega el disclaimer como párrafo al final del `plain_text` (ML no admite formato/tamaño). Aplica tanto en publicar (POST) como en actualizar (PUT description). Constante `_AI_IMAGE_DISCLAIMER`.
- No se guarda en el campo Descripción editable (no ensucia ni duplica al regenerar). Verificado por screenshot (Web, cursiva/menor) + prueba backend.

## Contenido comercial editable inline (corregir IA) — 2026-07-20
El usuario necesitaba editar el título y la descripción generados por la IA ahí mismo (ej. corregir "cerca del mar" cuando no aplica, o sumar detalles) antes de usarlos. Antes eran `<p>` de solo lectura.
- `ExpressSection.tsx`: el bloque Título pasó a `<input className="vera-express__edit-title">` y Descripción a `<textarea className="vera-express__edit-desc" rows=12>`, con estado local `editTitle`/`editDesc` que se inicializa del resultado IA vía `useEffect([data])`. "Usar" aplica el texto EDITADO (`applyTitle(editTitle)` / `applyDescription(editDesc)`), "Copiar" copia el editado, y "Copiar todo" arma el bloque con los valores editados. Hint "VERA propone; vos decidís".
- CSS nuevo: `.vera-express__edit-title/-desc` (dark, focus amarillo), `.vera-express__hint`. Verificado por screenshot (input+textarea editables, edición tomada) + tsc limpio.

## Contenido comercial: portales editables + regen por bloque + Usar y guardar — 2026-07-20
Tres mejoras sobre `ExpressSection.tsx` (opciones 1/3/4 elegidas por el usuario):
- **Portales editables (op.1)**: Mercado Libre y Zonaprop ahora son título (`<input>`) + cuerpo (`<textarea rows=8>`) editables (estado `editMl`/`editZp` init desde `data` en `useEffect`). "Copiar" y "Copiar todo" usan los valores editados. testids: `express-ml-title/-body`, `express-zp-title/-body`.
- **Regenerar por bloque (op.4)**: botón "Generar otro" en Título/Descripción/ML/Zonaprop (`regen-title/-description/-ml/-zp`) que llama `aiContentService.suggestTitles` / `suggestDescription` / `adaptForPortal(portal)` (endpoint `/api/ai/content` mode=title|description|portal). Estado `blockBusy` deshabilita mientras corre. Los portales se regeneran usando el título+descripción editados como contexto. "Generar todo otra vez" (`regenerate-express`) sigue rehaciendo todo.
- **Usar y guardar (op.3)**: prop `persist?(patch)` que baja desde `PropertyWorkspace` (`persistField`, solo en propiedad EXISTENTE → `propertyService.updateProperty` + invalida caches + pill "Guardado"). En existente el botón dice **"Usar y guardar"** y aplica+persiste en un paso; en propiedad nueva (sin id) dice "Usar" y solo aplica al form (se guarda con "Guardar"/"Guardar borrador"). Feedback `savedKey` → "Guardado" transitorio.
- Verificado: screenshot en propiedad existente (ML/ZP editables + "Generar otro" + "Usar y guardar"), curl de los 3 modes de `/api/ai/content`, tsc limpio.

## Contenido comercial A PRUEBA DE ERRORES (Título/Descripción = campos del form) — 2026-07-20
Bug reportado (producción): usuario cargó, dio "Guardar", propiedad quedó `active` pero título y descripción VACÍOS en la base (verificado por curl: `title=''`, `description=''`). Causa: el contenido de la IA vivía en estado local y solo llegaba al form al tocar "Usar"; si guardaban sin "Usar", se guardaba vacío.
- **Fix**: `ExpressSection.tsx` reescrito. Título (`manual-title`) y Descripción (`manual-description`) ahora son campos CONTROLADOS del formulario (`value={watch('title'/'description')}` + `setValue` onChange). Lo que se ve = lo que se guarda con "Guardar". Se eliminó el paso "Usar"/"Usar y guardar" y la prop `persist` (y `persistField` en `PropertyWorkspace`). "Generar publicación completa" y "Generar con VERA" (por campo) escriben directo al form vía `setValue`. Portales ML/Zonaprop siguen editables locales solo para copiar (no se persisten).
- Verificado en preview: crear propiedad + escribir título/descripción + un solo "Guardar" → `title` y `description` persistidos en la base (curl). tsc limpio.
- **PENDIENTE DE DEPLOY**: este fix (y toda la integración ML) está en PREVIEW; producción corre código viejo. Requiere REDEPLOY. La caja "vuelve sin hacer nada" de Mercado Libre en producción se explica porque los endpoints `/api/ml/*` no existen en el deploy viejo.

## Decisión de arquitectura — Web pública definitiva (2026-07-20)
Usuario decidió: **VERA = única fuente de verdad**; `www.varelapropiedadescde.com.ar` pasa a ser el sitio público de VERA. Sin CRM Legacy, sin sync, sin dos sistemas. El `/web` ya lee en vivo de VERA (arquitectura ya correcta).
- Custom domain: Emergent soporta "Link domain" → "Entri" (DNS), SSL automático, www + apex, sin costo extra (dentro del fee de deploy). Cambios de código requieren REDEPLOY manual.
- PENDIENTE (esperando alcance del usuario): Home/landing, contacto/leads (tel/WhatsApp/form), buscador de texto libre, SEO (title/meta/OG/sitemap; hoy es SPA con title "VERA OS"), y servir el sitio público en la raíz del dominio con el sistema interno en ruta aparte.
- Definición de "Workspace Propiedades terminado": CRUD ✅, Fotos ✅, Documentos ✅, Propietarios ✅, Publicación Web sobre dominio propio (pendiente deploy+dominio), Publicación Mercado Libre (pendiente deploy+redirect prod).


## Fix bugs "Ver en la web" (dominio) + ML datetime — 2026-07-20
Reportados por el usuario (producción, código viejo pre-redeploy):
- **"Ver en la web" apuntaba a `/web/{id}` (dominio VERA)** en vez del dominio real. Causa: `ChannelsSection.tsx` armaba el link para el canal web con `webUrl = ${origin}/web/${id}` (espejo VERA), ignorando el `url` guardado. Fix: `href={url || webUrl}` (usa el `url` persistido, que `web_publisher` setea a `https://www.varelapropiedadescde.com.ar/?propiedad=<legacyId|vera-id>`). VERIFICADO que el sitio real lee `params.get('propiedad')` → el formato del link es el correcto y abre la ficha puntual. La `publications['web-varela'].url` en la base compartida ya quedó con el dominio real.
- **ML "can't compare offset-naive and offset-aware datetimes"**: `mercadolibre/service.py::_valid_token` comparaba `tok["expires_at"]` (Mongo devuelve datetimes NAIVE) con `_now()` (aware). Fix: normalizar `expires_at` a UTC-aware antes de comparar. Verificado (token simulado naive → `_valid_token` no crashea). El usuario YA está conectado a ML (el token existe); el bug solo rompía la comparación al publicar.
- Ambos fixes en PREVIEW → requieren REDEPLOY para verse en producción. tsc limpio.


## "Publicar en Web" escribe en la web ACTUAL de Varela (CRM Legacy) — 2026-07-20
Decisión del usuario (revisada): NO reemplazar la web actual todavía. La web `www.varelapropiedadescde.com.ar` es una página estática que lee EN VIVO la tabla `propiedades` del CRM Supabase (`fwwzjynerfghqsakkyvq`) y muestra toda propiedad con `estado` ∈ {Disponible, Reservada, Vendida} (query verificada en el JS del sitio). Objetivo del sprint: que "Publicar en Web" haga aparecer la propiedad en ESA web.
- **Driver desacoplado** `backend/web_publisher.py` (canal `web-varela`): `publish()` hace upsert en `propiedades` (mapeo VERA→CRM: type→tipo, operation→operacion, status→estado [active=Disponible, reserved=Reservada, sold=Vendida], price→precio, address/neighborhood/city/province, rooms/bedrooms/bathrooms, area_m2→mts_cubiertos, lot_area_m2→mts, amenities, fotos[]=URLs firmadas TTL ~10 años de las imágenes de VERA, codigo). `unpublish()` oculta poniendo `estado='Pausada'` (la web no lo muestra; fila conservada). `web_url()` → `https://www.varelapropiedadescde.com.ar/?propiedad=<legacyId>`.
- **Idempotencia**: id de la fila web = `legacy_id` (importadas) o `vera-<id>` (nacidas en VERA).
- **Wiring**: `routes_properties.py` `set_publication` llama publish/unpublish para `web-varela` (502 si falla) y setea `publications['web-varela'].url` al link real del sitio. `update_property` hace **auto-resync** best-effort: si está publicada, re-publica al Guardar (refleja precio/fotos/estado/descripción). Frontend ya cableado (`ApiPublicationGateway` → mismo endpoint).
- **BLOQUEO RESUELTO**: `propiedades` tiene trigger que inserta en `historial_precios`; la key `anon/publishable` NO puede escribir ahí (RLS 42501) → cualquier UPDATE con `precio` fallaba (INSERT nuevo sí funcionaba). Solución: usar **service_role**. Nuevo env `CRM_SUPABASE_WRITE_KEY` (service_role, en backend/.env, SOLO server-side) usado por `web_publisher._headers()`; cae a la publishable si no está. `config.CRM_SUPABASE_WRITE_KEY`.
- **Verificado (curl + UI)**: publicar nueva, cambiar precio+estado con auto-resync, re-publicar sobre existente, despublicar/ocultar; UI muestra "Publicada" (verde) + "Ver en la web" + Actualizar/Despublicar. Todas las pruebas limpiadas de la base.
- **PENDIENTE DE DEPLOY**: todo esto está en PREVIEW. Requiere REDEPLOY a producción; el env `CRM_SUPABASE_WRITE_KEY` debe viajar en el deploy. Recordar también el redirect de ML en prod.

## Fix ML publish: superficies con value_struct (item.attributes.omitted) — 2026-07-20
Error real capturado en `properties.publications['mercadolibre'].error` (prop 9c1d4217): `item.attributes.omitted` sobre `TOTAL_AREA` ("Attribute TOTAL_AREA with value 550 m² was omitted"). Causa raíz: `mercadolibre/service.py::_payload` enviaba superficies como texto libre `value_name: "550 m²"`. La API actual de ML exige **value_struct** `{number, unit:"m2"}` (ASCII "m2", NO el símbolo "m²") y prohíbe mezclar con `value_name`; al quedar mal formado ML omite el atributo requerido → 400.
- **Fix**: refactor de atributos en `_payload` con helpers `_area_attr` (value_struct m2, se omite si 0), `_num_attr` (BEDROOMS/FULL_BATHROOMS numéricos, se omiten si 0) y `_attributes()`. OPERATION queda como value_name (funcionaba en las 25 publicaciones OK previas). Verificado estructuralmente con los datos de la prop que falló (payload correcto).
- **routes_ml.py**: el error guardado/propagado se amplió de 300→800 chars + `logger.error` con detalle completo, para depurar si ML devuelve otra causa.
- **PENDIENTE**: verificación end-to-end del POST real a ML. En PREVIEW ML figura desconectado (tokens NO se comparten con producción). Requiere que el usuario conecte ML en Preview para testear, o REDEPLOY y probar en producción. tsc/backend OK.

## Fix ML publish COMPLETO — categoría hoja + atributos por esquema + ubicación por catálogo — 2026-07-21 (RESUELTO E2E)
El usuario conectó ML en Preview (cuenta INMOVARELA, seller 199060820) y se depuró la publicación real contra la API contra la propiedad 9c1d4217 hasta lograr **item creado: MLA3637392782**. Tres bloqueantes reales encontrados y resueltos en `mercadolibre/service.py`:
1. **Categoría inválida** (`item.category_id.invalid`, MLA1466 no es hoja): ahora la categoría HOJA se resuelve DINÁMICAMENTE con `/sites/MLA/domain_discovery/search?q=<tipo> en <operación>` (`_resolve_listing`). Fallback `_CATEGORY_FALLBACK`. Ej.: casa venta→MLA401685, terreno venta→MLA401803.
2. **Atributos obligatorios** (`item.attributes.missing_required` [TOTAL_AREA, COVERED_AREA, PARKING_LOTS]; y superficies "dropped"): se consulta el ESQUEMA real de la categoría `/categories/{id}/attributes` (`_category_attributes`) y se arman SOLO los atributos required que sabemos mapear (`_ATTR_VALUE`: TOTAL_AREA, COVERED_AREA, BEDROOMS, FULL_BATHROOMS, PARKING_LOTS, ROOMS). `number_unit` usa `value_name "<n> <unidad>"` con la unidad EXACTA del esquema (es **"m²"** con símbolo, NO "m2"). Se ignoran atributos fixed/hidden (OPERATION/PROPERTY_TYPE los pone la categoría). Robusto por tipo: terreno solo pide TOTAL_AREA.
3. **Ubicación** (`item.location.invalid`, "requires up to city level"): coords solas no alcanzan. `_location` (async) resuelve `state.id` contra el catálogo `/classified_locations/countries/AR` (`_resolve_state_id`, match por nombre normalizado; BA→provincia válida) + `country.id="AR"` + `city.name` libre + lat/long. Cache de provincias en `_STATES_CACHE`.
- **Verificado**: publish real 200 → status ML `not_yet_active` con sub_status `pack_quota_pending` + `picture_download_pending` (12 fotos cargadas). Esto NO es del código: `pack_quota_pending` depende del paquete/cupo de publicaciones de inmuebles de la cuenta ML (la cuenta tiene `silver`/"Plata" remaining_listings=66); `picture_download_pending` se resuelve solo. VERA marcó la propiedad `publications.mercadolibre.status=published` con itemId+url.
- **Usuario QA temporal Preview**: `qa_varela@vera.test` / `VeraQA!2026ml` (Supabase compartido). Borrar al cerrar sprint.
- **PENDIENTE DE DEPLOY**: fix en PREVIEW → requiere REDEPLOY para producción. Item de prueba MLA3637392782 quedó creado en la cuenta real (es la propiedad real del usuario; re-publicar hace UPDATE, no duplica).

## Fix ML update/reintento — aviso cerrado, título/moneda no modificables, guard "activándose" — 2026-07-21
Reportado: publicó OK, luego actualizó (no subía foto principal), finalizó el aviso (quedó `closed`) y al reintentar ML tiró `item.title.not_modifiable` / `price.not_modifiable` / `field_not_updatable` (currency_id, pictures, available_quantity). Causa: el PUT reenviaba campos que ML NO permite modificar (title, currency_id) y encima el item estaba cerrado (no editable). Fix en `publish()`:
- Antes de actualizar consulta el estado del item (`_item_status`). Si está `closed`/no editable o no hay itemId → **crea uno nuevo** (POST). Si está `active`/`paused` → PUT SOLO `price` + `pictures` (title y currency_id nunca son modificables en ML) + descripción aparte.
- Si el item está `not_yet_active`/`payment_required`/`under_review` → NO duplica: lanza mensaje amigable "El aviso todavía se está activando en Mercado Libre… reintentá en un rato".
- Verificado E2E: reintento sobre item cerrado → crea nuevo (MLA3637462078); guard de "activándose" devuelve el mensaje amigable; y update real (precio+fotos) sobre item ya `active` → 200 OK. La foto principal se actualiza al reenviar el set completo ordenado. La activación (`not_yet_active`→`active`) tarda unos minutos del lado de ML (pack_quota_assigned automático; la cuenta tiene 66 "Plata").

## Estado ML en vivo en VERA (Publicaciones) — 2026-07-21
El panel de Publicaciones ahora muestra el estado REAL del aviso en Mercado Libre, sin entrar a ML.
- **Backend** (`mercadolibre/service.py::item_state` + `routes_ml.py GET /api/ml/listings/{property_id}/state`): lee `status`+`sub_status`+`permalink` reales de ML y los mapea a etiqueta ES + tono (`_ML_STATE_LABEL`): active→"Activo en Mercado Libre"(verde), paused→"Pausado", not_yet_active/under_review→"Activándose…"(spinner), payment_required→"Pago pendiente", closed/inactive→"Finalizado/Inactivo". Devuelve `activating` (bool) para el polling. Verificado por curl (devuelve "Activo").
- **Frontend** (`ChannelsSection.tsx`): `useQuery(['ml-state', propertyId])` habilitado cuando ML está conectado y la propiedad está publicada; `refetchInterval` 12s solo mientras `activating`. El estado del canal ML usa la etiqueta/tono en vivo (spinner si se está activando) y el link "Ver aviso" usa el permalink real de ML. tsc limpio, webpack "No issues found".
- **PENDIENTE DE DEPLOY**: todo en PREVIEW → requiere REDEPLOY.

## Semáforo de canales (Web + ML) en la grilla de Propiedades — 2026-07-21
El usuario pidió ver de un vistazo, en cada tarjeta de la grilla, el estado de publicación en Web y en Mercado Libre.
- **Frontend** (`PropertiesScreen.tsx`): nuevo componente `ChannelSemaphore` en el cuerpo de cada tarjeta (debajo de specs). Muestra dos indicadores "Web" y "ML" con un punto de color: verde=`published`, rojo=`error`, gris=sin publicar (`channelTone`). Lee `property.publications['web-varela'].status` y `['mercadolibre'].status` (el listado ya devuelve `publications`, sin llamadas extra por tarjeta). Con `aria-label`/`title` accesibles. CSS `.vera-prop__channels`/`.vera-prop__channel` en index.css reutilizando `.vera-dot--*`.
- Decisión: en la grilla se usa el estado GUARDADO (barato, N tarjetas sin N llamadas a ML). El estado EN VIVO de ML (activándose/activo/pausado) queda en la ficha (sección Publicaciones).
- **Verificado E2E** (iteration_27.json): 10/10 tarjetas renderizan el semáforo; propiedad 9c1d4217 con ambos puntos verdes; layout intacto; sin errores de consola. tsc limpio.
- **PENDIENTE DE DEPLOY**: en PREVIEW → requiere REDEPLOY.

## Fix color del semáforo + confirmación sync de estado a la web — 2026-07-21
1. **Bug color semáforo**: los puntos salían grises. Causa: había una SEGUNDA definición `.vera-dot` en `index.css` (después de los modificadores `.vera-dot--published/error/none`) que fijaba `background` gris y, por orden de cascada (misma especificidad), pisaba el color. Fix: quité `background` de esa segunda `.vera-dot` (solo define tamaño). Verificado con Playwright: los puntos de la propiedad publicada computan `rgb(34,197,94)` (verde). 
2. **Estado → web (Reservada/Vendida)**: YA funcionaba. `web_publisher._row` mapea status→estado (reserved→Reservada, sold→Vendida) y `routes_properties.update_property` hace auto-resync al CRM `propiedades` cuando `web-varela` está published (las 29 propiedades lo están). Verificado E2E: PATCH status=reserved en VERA → CRM `estado="Reservada"` (dispara el sello RESERVADA/VENDIDA que la web ya renderiza); revertido a Disponible. El sitio ya soporta los sellos por `estado`; no requiere cambios en la web. Si el usuario no lo veía, es por deploy viejo / caché del sitio.
- **PENDIENTE DE DEPLOY**: el fix del color está en PREVIEW → REDEPLOY. El sync de estado ya debería estar en prod si redeployó tras el sprint web.

## Consulta por WhatsApp con contexto de propiedad (base Arturito) — 2026-07-21
Botón "Consultar por WhatsApp" por propiedad que abre WhatsApp con mensaje precompletado (código, título, link) + tracking, y registra el evento de consulta en VERA. Primer punto de contacto sitio público ↔ ecosistema VERA.
- **Backend** (`inquiries.py` + `config.py` + `routes_public.py`):
  - `config.WHATSAPP_NUMBER` (def 5492246586030, env override) y `config.PUBLIC_WEB_BASE_URL` (def https://www.varelapropiedadescde.com.ar).
  - `inquiries.py`: `whatsapp_url(prop)` arma `https://wa.me/<num>?text=<msg url-encoded>`; `public_url(prop)` = `{base}/propiedades/{code.lower()}?source=website&property_id=<uuid>&property_code=<code>` (tracking para que Arturito identifique propiedad/canal/URL). `register_inquiry(prop)` inserta en Mongo `website_inquiries` (event 'Website Property Inquiry', channel Website, origin Ficha de Propiedad, property_id/code/title, url, status 'pendiente_contacto', created_at ISO). Nada hardcodeado: todo se genera por propiedad.
  - `GET /api/public/listings` y `GET /api/public/listings/{id}` ahora incluyen `whatsappUrl` + `publicUrl`. Nuevo `POST /api/public/inquiries {property_id}` → registra evento y devuelve `{whatsappUrl, publicUrl, inquiryId}`.
- **Frontend** (páginas públicas VERA `/web` y `/web/:id`): botón WhatsApp verde institucional (`.vera-wa-btn`). Ficha = CTA principal (abre wa.me, registra evento vía `logInquiry`). Grilla = botón por tarjeta (`openWhatsAppInquiry`: registra + window.open, con stopPropagation para no navegar al detalle). Se oculta en propiedades `sold`. Helper `whatsappInquiry.ts`. Mobile abre la app de WhatsApp (wa.me nativo).
- **Verificado** (Playwright + curl + Mongo): 26 botones en grilla (oculto en VENDIDA), 1 en ficha con href correcto; POST registra el evento con contexto completo. tsc limpio.
- **IMPORTANTE — dónde vive**: implementado en las páginas públicas de VERA (ESTE proyecto). El sitio EN VIVO del usuario (varelapropiedadescde.com.ar) es EXTERNO y NO está en este repo → para que el botón aparezca allí, ese sitio debe consumir `GET /api/public/listings` (usa `whatsappUrl`) y `POST /api/public/inquiries`, o migrar a las páginas públicas de VERA. El usuario no confirmó quién edita el sitio externo (ask_human quedó sin responder ese punto).
- **PENDIENTE DE DEPLOY**: en PREVIEW → REDEPLOY.

## Sprint Personas (MVP) — VERA Core — 2026-07-21
Personas es la entidad maestra (identidad única por `person_id`). App de consulta/administración; sin lógica comercial (sólo muestra relaciones).
- **Migración Supabase `people`** (corrida por el usuario, `backend/migrations/people_extend.sql`): +`phones` jsonb, +`emails` jsonb, +`document`, +`status`, +`primary_phone`, +`primary_email` (explícitos, NO derivados del array[0]). Legacy `phone`/`email` se mantienen sincronizados con los principales para compat (OwnerSection).
- **Backend**: `people/repository.py` (extendido, sync primary↔legacy), `people/events.py` (timeline por EVENTOS tipados en Mongo `person_events`: PersonCreated/ConversationStarted/PropertyVisited/PropertyInquiry/OpportunityCreated/OfferSent/PropertyReserved/PropertySold), `people/resolver.py` (`PersonResolver` genérico: resuelve por phone/whatsapp/email/document sin acoplarse a un canal; find-or-create), `people/service.py` (enriquecimiento: propertiesCount por `owner_id`, conversationsCount + lastContact desde proveedor MOCKEADO, relaciones propietario, timeline). Rutas en `routes_people.py`: GET `/api/people` (enriquecido), POST (crea + evento PersonCreated), GET/PATCH `/{id}`, GET `/{id}/relations|conversations|timeline`, POST `/resolve`.
- **Frontend**: App Personas habilitada (`featureFlags.personas=true`). `PeopleScreen` (listado + buscador instantáneo nombre/tel/email, tabla compuesta con primitivos @vera/ui). `PersonDetail` con 4 pestañas: Datos (edición: nombre, primary phone/email, teléfonos/emails múltiples con chips, documento, observaciones, roles múltiples toggle, estado Activo/Inactivo manual), Relaciones (propiedades donde es propietario; "comprador/inquilino/garante" = próximamente), Conversaciones (read-only, MOCKEADAS, cada una abre Arturito), Timeline (eventos tipados renderizados por `type`). Tipos/gateway/service/hooks extendidos. CSS nuevo (tabla, tabs, ficha, timeline) con tokens del Design System.
- **Principio (VERA Core)**: ningún módulo almacena datos propios de una persona; todos referencian por `person_id`. Toda nueva funcionalidad sobre seres humanos se integra sobre esta entidad única.
- **Verificado E2E**: backend por curl (create múltiples campos/roles, update, PersonResolver find+create, timeline PersonCreated); frontend por testing_agent iteration_28.json → 100% (10/10). Datos de prueba limpiados. Ajuste cosmético aplicado (contador oculto durante carga). Conversaciones/parte del timeline = MOCKEADOS hasta integrar WhatsApp/Kommo/Arturito.
- **PENDIENTE DE DEPLOY**: en PREVIEW → REDEPLOY. Prioridad siguiente (usuario): Arturito + contrato de eventos Arturito→VERA. Botón WhatsApp del sitio externo: EN PAUSA.

## Sprint VERA Core — Projection Handlers + Conversation Adapter Contract — 2026-07-21
Los eventos del pipeline ahora generan AUTOMÁTICAMENTE las entidades de negocio (Leads, Oportunidades, Tareas). Verificado 100% por testing_agent (iteration_29: 28/28 backend) + curl. Todo referencia a la persona por `person_id`.
- **Nuevo dominio `/app/backend/core/`** (VERA Core = lógica de negocio):
  - `types.py`: enums + reglas puras. Lead (`nuevo→contactado→calificado→convertido→perdido`, sólo avanza), Opportunity stages (`interes→visita_agendada→visitada→oferta→reserva→ganada`/`perdida`, sólo avanza; `ganada`/`perdida` terminales), Task types (`responder·contactar·confirmar_visita·seguimiento·seguir_oferta`) + status (`pendiente·hecha·descartada`).
  - `store.py`: proyecciones en MongoDB (`leads` único por `person_id`; `opportunities` único por `person_id`+`property_id`; `core_tasks` con dedupe de tarea PENDIENTE por persona+propiedad+tipo). Son read-models MUTABLES reconstruibles.
  - `handlers.py`: `project(event)` mapea cada tipo de evento → Lead/Opportunity/Task; registrado en `events.projections`. `rebuild()` reproduce todo el stream en orden cronológico.
- **Endpoints** (`routes_core.py`): `GET /api/core/leads|opportunities|tasks` (filtros por status/stage, 422 si inválido), `PATCH /api/core/tasks/{id}` (hecha/descartada — el humano decide), `PATCH /api/core/opportunities/{id}` (override manual de etapa, NO aplica la regla de sólo-avanzar), `POST /api/core/rebuild`, `GET /api/core/summary`.
- **Conversation Adapter Contract** (agnóstico del proveedor): el contrato de eventos dejó de nombrar a Arturito como "la" capa; Arturito es sólo el PRIMER adapter. Cualquier motor conversacional envía los mismos eventos a `POST /api/events` sin cambios en VERA Core. `events/contract.py` reescrito (docstring + `EVENT_SOURCES` ampliado: arturito/website/crm/app/system/conversation/whatsapp/kommo/instagram/facebook). Doc nuevo `/app/docs/CONVERSATION_ADAPTER.md` (agregado a `DOC_ORDER` de VeraKnowledgeSource).
- **Reglas de proyección**: Leads/Opps sólo avanzan (no retroceden); tareas no se duplican (una pendiente por tipo); eventos anónimos (sin `person_id`) y `PersonCreated` NO generan negocio; idempotencia por `idempotencyKey` (dedupe en ingesta) + claves naturales en proyecciones (rebuild idempotente).
- **Bug corregido**: `channel` aparecía en `$setOnInsert` y `$set` a la vez (conflicto Mongo code 40) → sólo en `$set` cuando presente. Regresión: `/app/backend/tests/test_vera_core_projections.py` (28 tests).
- **PENDIENTE**: UI de Operaciones (Leads/Oportunidades/Tareas hoy sólo por API, la App Operaciones sigue "Próximamente"). Deploy: en PREVIEW → REDEPLOY.

## Sprint Arturito API Discovery (SOLO descubrimiento, sin implementar) — 2026-07
Se descubrió empíricamente la API de Arturito con la API Key `art_…` provista. Resultado en **`/app/docs/ARTURITO_API_DISCOVERY.md`** (agregar a DOC_ORDER cuando se implemente). Hallazgos clave:
- **Arturito SÍ tiene API** (contra la conclusión previa de "plataforma cerrada"). Backend = **tRPC** en `https://app.arturito.ai/api/trpc/*` (mismo origen del Next.js/Vercel; auth del dashboard = Auth0). Sin OpenAPI público.
- **Auth de la API Key**: header `Authorization: Bearer art_…` (X-Api-Key NO). Sin transformer (input JSON crudo en `?input=`). Respuestas `{"result":{"data":…}}`, errores Zod.
- **La key puede LEER** agents/pipeline/leads/tags/métricas y **gestionar webhooks**; NO puede gestionar api keys (403). Atada a 1 workspace (`6a54f832f4c16e6124260f28`, agente "Vera").
- **Webhooks salientes** (camino primario): eventos `lead.created` y `lead.attended`, firmados **HMAC-SHA256** (`X-Arturito-Signature`), filtro por agente, logs/reintentos. **YA existe** un webhook en `https://bot.varelapropiedadescde.com.ar/webhook/arturito` (decidir coexistencia vs reemplazo).
- **Esquema del lead** (Chatwoot-backed + Tokko/GHL): phone/normalizedPhone, name, tags, pipelineStage (`qualifying/qualified/manual_attention/lost/won/paused`), leadScore, intentDetected, lastMessageContent, notes[], timestamps.
- **Limitaciones**: transcript de mensajes (`getMessagesByConversationId`) devuelve 403/412 con la key; contrato no versionado/no autodescubrible; 1 key = 1 workspace.
- **Recomendación (a implementar luego, con aprobación)**: `ArturitoWebhookAdapter` (PUSH → traduce a eventos del Conversation Adapter Contract → `POST /api/events`) + `ArturitoClient` tRPC (PULL para backfill/enriquecimiento). Mapeo de etapas casi 1:1 con VERA Core.
- La API Key NO se guardó aún en `.env` (sprint de discovery). Al implementar: `ARTURITO_API_KEY` solo backend.

## Sprint ArturitoWebhookAdapter (implementación PUSH) — 2026-07-21
VERA es ahora el **receptor primario** de los eventos de Arturito. Verificado E2E (entrega real firmada de Arturito + POST firmado manual + idempotencia + firma inválida 401 + proyecciones de VERA Core). Sin backfill todavía (por decisión del usuario: validar primero con leads reales nuevos).
- **Endpoint**: `POST /api/integrations/arturito/webhook` (`routes_integrations.py`). Valida `X-Arturito-Signature` (HMAC-SHA256 sobre el body crudo, prefijo `sha256=`); si el secret está configurado y la firma no valida → 401. Audita cada entrega en Mongo (`arturito_deliveries`); vista dev `GET /api/integrations/arturito/deliveries`.
- **Adapter** (`integrations/arturito/adapter.py`): traduce `lead.created` → `ConversationStarted` + `PropertyInquiry` (VERA Core crea Lead `nuevo` + tarea "Contactar"); `lead.attended` → `MessageReceived` (actividad + tarea de seguimiento). Ingresa vía `pipeline.ingest` (Conversation Adapter Contract). Idempotencia por `event_id` (los reintentos de Arturito lo conservan).
- **Client tRPC** (`integrations/arturito/client.py`): helpers `list/create/delete_webhook` (usados para provisionar) + base para el backfill futuro.
- **Provisioning**: webhook de VERA creado (`webhooks.create`, id `01KY2Q55V8585DMWYK2J8FB9JW`) → PREVIEW url. Webhook viejo (`bot.varelapropiedadescde.com.ar`) ELIMINADO (`webhooks.delete`). Sólo queda el de VERA.
- **Secrets en backend `.env`**: `ARTURITO_API_KEY`, `ARTURITO_WORKSPACE_ID`, `ARTURITO_WEBHOOK_SECRET` (secret del webhook, mostrado una sola vez por Arturito). Solo backend.
- **Payload real confirmado** en `/app/docs/ARTURITO_API_DISCOVERY.md` §7.1 (lead bajo `lead`, id=`id`, mensaje/resumen en `conversation.summary`, `intent`).
- **PENDIENTES**: (1) al redeployar, actualizar la URL del webhook a PRODUCCIÓN (`webhooks.update`); (2) backfill histórico vía tRPC tras validar; (3) mensaje completo (`getMessagesByConversationId`) sigue restringido con la key.

## Sprint Operaciones + Completar Proyecciones — 2026-07-21
Verificado: testing_agent iteration_30 (frontend 100%, backend 8/9 → el único fallo, 500 en ObjectId inválido, YA corregido → 404). Regresión: `/app/backend/tests/test_operaciones_sprint30.py`.
- **Proyecciones de Persona completadas**: `people/service.enrich_list_item` ahora deriva `lastContact` y `conversationsCount` del **event store real** (antes venían del provider MOCKEADO → quedaban vacío/0 para personas de Arturito). Verificado con la persona real "Cata 💓" (lastContact ok, convs 1).
- **Nombre canónico en proyecciones**: `core/handlers._person_name` usa el nombre del registro de la Persona (VERA Core = fuente de verdad de identidad) por sobre el alias de cada evento (una misma persona puede tener alias distintos entre conversaciones; ej. "Cata 💓" vs "Noelia" con el mismo teléfono → el resolver los unificó, y el Lead/Tarea muestran el nombre canónico).
- **Endpoints nuevos** (`routes_core.py`): `GET /api/core/kpis` (personas, leadsActivos, oportunidadesAbiertas, tareasPendientes, conversacionesHoy) y `GET /api/core/activity?limit=` (timeline global con labels en español). Guard de `ObjectId` en `update_task_status`/`update_opportunity_by_id` → 404 en id inválido.
- **App "Operaciones"** (`/app/frontend/src/app/screens/OperacionesScreen.tsx`, ruta `/operaciones`, flag `operaciones:true`): tablero READ-ONLY con KPIs + 4 columnas (Nuevos Leads, Oportunidades por etapa/embudo, Tareas pendientes con completar, Actividad reciente/timeline global). Auto-refresh 15s. Botones: Lead→"Ver Persona" (`/personas/:id`), Oportunidad→"Abrir Propiedad" (`/propiedades/:id`), y en la ficha de Persona→"Abrir Arturito" (`PersonDetail`). Sin lógica comercial: sólo refleja VERA Core. CSS `.vera-ops__*` en `index.css`.
- **Limitación conocida**: los eventos de Arturito no traen `propertyId` de VERA → no crean Oportunidad (sólo Lead + tarea "Contactar"). La columna Oportunidades se puebla con eventos que sí traen propiedad (web/app/futuro matching).
- **PROPUESTA DEL USUARIO (pendiente de decisión)**: renombrar/promover "Operaciones" a **"Hoy"** como tablero principal, dejando Personas/Propiedades/Arturito/Studio como apps especializadas. HOY `/hoy` = `WorkspaceHome` (escritorio ambiental existente). No se tocó; a confirmar si se reemplaza.

## Sprint VERA Brain v1 — Knowledge Engine — 2026-07-21
"Arturito conversa, VERA aprende". VERA NO guarda conversaciones; transforma el resumen (lead.attended) en **conocimiento estructurado y acumulativo**. Verificado: testing_agent iteration_31 (backend 10/10, frontend 9/9) + regresión `tests/test_knowledge_engine.py`.
- **Módulo `/app/backend/knowledge/`** (VERA Core): `extractor.py` (LLM Claude vía `vera_brain.active_provider` → HECHOS JSON, sin texto libre), `store.py` (colección Mongo `knowledge_facts` — un doc por hecho con metadatos {type,value,confidence,source,first_detected,last_confirmed,status}; merge acumulativo; contradicción en tipos single-valued → conserva ambos y marca `review`; nunca borra), `service.py` (learn_from_summary + person_knowledge/view), `projection.py` (dispara aprendizaje en BACKGROUND cuando un evento trae `payload.summary`).
- **Endpoints**: `GET /api/people/{id}/knowledge` (vista categorizada + readable + confianza), `POST /api/people/{id}/knowledge/learn` (síncrono, para pruebas/backfill), `GET /api/knowledge/facts?type=&value=` (consulta estructurada del activo, ej. "todos los agrimensores", "budget>...").
- **Modelo de conocimiento**: categorías roles/relationship/interests/preferences/facts/businessContext/aiTags + confidence (Alta/Media/Baja) + lastUpdated. Tipos: role, relationship, intent, profession, company, business_context, property_type, location, budget(+currency), bedrooms, payment_method, accepts_credit, preference, restriction, next_step, decision_maker, involved_person, fact, tag.
- **Frontend**: pestaña **🧠 Conocimiento** en la ficha Persona (`PersonDetail.tsx` → `ConocimientoTab`, hook `usePersonKnowledge`, gateway `knowledge()`): "Lo que VERA sabe" (bullets), badge de confianza, sección "Para revisar (contradicciones)", y conocimiento estructurado por categoría con % de confianza. CSS `.vera-knowledge__*`.
- **Bug corregido (de iteration_31)**: `people_repository.get` con id no-UUID devolvía 500 → ahora captura APIError 22P02 → 404 (beneficia a todas las rutas `/people/{id}`).
- **Validado**: extracción real (Juan Pedro Andersen → Agrimensor/Proveedor/Servicio profesional, coincide con el ejemplo del sprint), trigger automático en background (comprador → budget/bedrooms/credit/zona), idempotencia (confirmed sin duplicar), contradicción→review, consulta estructurada.
- **NO implementado (por decisión)**: campañas, recomendaciones, matching, automatizaciones, prompts de Arturito. Sólo el motor que transforma conversaciones en conocimiento (reutilizable a futuro por Studio/Marketing/Matching/Dashboard).






- Swap mocks in `src/packages/services/service-container.ts` (single wiring point).
- New App = new screen + feature-flag flip in `@vera/config` + route in `VeraOS.tsx`.
- All visual values come from `@vera/design-tokens`; never hardcode.


## Implemented (Sprint "Personas — Tabla configurable + Exportación" — 2026-07)
App Personas ahora tiene DOS vistas con toggle (persistido en localStorage `vera:people:view`, default **Tabla**): **Tarjetas** (visual) y **Tabla** (data grid configurable enriquecida con conocimiento). Verificado 100% por testing agent (iteration_32): backend 16/16 pytest + frontend todos los flujos E2E, `tsc` limpio. Base pensada para reutilizar en el futuro módulo **Audiencias**.
- **Filtros de negocio (no de base de datos), combinables con AND**: Rol, Relación con Varela, Intención, Tipo de propiedad de interés, Zona de interés (selects alimentados por `GET /api/people/facets`), Presupuesto mín./máx. (USD), Última interacción (7/30/90 días) y Nivel de confianza (Alta ≥0.85 / Media ≥0.6). Botón "Limpiar (N)".
- **Columnas configurables**: menú con checkboxes por columna (catálogo de 15 keys, 9 por defecto), persistido en localStorage `vera:people:columns`.
- **Selección de filas** (select-all + por fila) y **Exportación CSV / Excel** que respeta filtros, columnas visibles y la selección. Excel (`openpyxl`) profesional: encabezados, `auto_filter`, `freeze_panes`, ancho automático, fechas válidas (tz stripped → naive UTC).
- **Backend** (`/app/backend/people/table.py`, `routes_people.py`): `GET /api/people/table` (rows enriquecidas + filtros AND multi-hecho + orden + paginación, pageSize clamp 1–200), `GET /api/people/facets`, `GET /api/people/export?format=csv|xlsx`. `build_rows` acepta `facts: list[(type,value)]`, `confidence_min`, `contacted_within_days`. `knowledge/store.summarize()` ahora expone `relationship`, `intent`, `propertyType`. `openpyxl==3.1.5` en `requirements.txt`.
- **Frontend**: `DataTable.tsx` (grid genérico reutilizable en `@vera/ui`), `PeopleScreen` (contenedor + toggle), `PeopleTableView`, `PeopleFilters`, `PeopleCardsView`; gateway `table()/facets()/exportUrl()`; hooks `usePeopleTable`/`usePeopleFacets`.
- **Backlog registrado (no bloqueante, del code review)**: OR-within-type si un filtro pasa a multi-valor; debounce en inputs de presupuesto; merge de columnas nuevas del catálogo cuando localStorage está desactualizado; hora local AR en Excel; export vía fetch+Blob si el backend suma JWT.
- **Upcoming**: P0 promover "Operaciones" → "Hoy" (landing con actividad y prioridades del día); P1 Matching de propiedades con hechos del Knowledge Engine; P2 APIs reales Zonaprop/Argenprop; P2 módulo Audiencias reusando `DataTable`.



## Implemented (Sprint "Exportar / Backup de fotos de la propiedad" — 2026-07)
Primer paso de VERA como **repositorio confiable de activos digitales**: descarga de los archivos ORIGINALES de una propiedad. Verificado 100% por testing agent (iteration_33): backend 6/6 pytest + frontend 3/3, `tsc` limpio. Sin mutar datos reales.
- **Descarga individual**: botón en cada foto (aparece al hover) → `GET /api/properties/{id}/images/{imageId}/download` (archivo original, con su nombre, Content-Disposition RFC 5987).
- **Descargar todas (.zip)**: botón en la galería → `GET /api/properties/{id}/export/photos.zip`. ZIP con las fotos **originales** en el **orden del usuario** (`position`) y **nombres secuenciales** `01-<nombreOriginal>.ext`, `02-...`. Nombre del ZIP: `VAR-XXXXXX-fotos.zip`.
- **Regla permanente**: VERA nunca modifica el archivo original; al exportar entrega siempre el original tal cual se subió (el pipeline "Studio" sigue deshabilitado; miniaturas/optimizadas/IA futuras nunca reemplazan al original).
- **Diseño reutilizable para el futuro "Exportar Propiedad"**: `property_export.py` (`ExportEntry`, `photo_entries`, `build_zip`, `zip_filename`) recibe una lista de entradas y arma el ZIP descargando objetos originales de Storage. Para sumar documentos/planos/videos/datos: agregar colectores de entradas (sin cambiar el builder). `StorageService.download()` nuevo (bytes del original). Frontend: `triggerBrowserDownload` + gateway `imageDownloadUrl()`/`photosZipUrl()`; los botones solo aparecen en propiedades ya guardadas (guard `isNew`).
- **Backlog (del code review, para cuando escale "Exportar Propiedad")**: paralelizar descargas (asyncio.gather + Semaphore) y usar `StreamingResponse`/zipstream para ZIPs grandes (docs+videos); log cuando falta `original_name`; transliterar el fallback ascii del filename; `:focus-visible` en el botón de descarga por foto; endurecer ambos endpoints con JWT cuando se active auth.
- **Próximo paso definido por el usuario**: modelo de METADATA de imágenes más rico (tipo por foto: Frente/Living/Cocina/Dormitorio/Baño…) que servirá para exportación, Studio, publicaciones automáticas, validaciones de calidad y análisis por IA. (Se evita agregar un campo "descripción" que después haya que reemplazar.)



## Implemented (Sprint "Compartir Propiedades — URL pública canónica" — 2026-07)
Toda propiedad publicada tiene una **URL pública canónica** de la que VERA es dueño; toda la app la reutiliza (Compartir, Studio, QR, emails, campañas, analytics, futuras APIs). Verificado 100% por testing agent (iteration_34): backend 6/6 pytest + frontend E2E (incluyó readback del portapapeles y estado deshabilitado). `tsc` limpio.
- **Fuente única de verdad** en `inquiries.py`: `canonical_url(prop)` = `{PUBLIC_WEB_BASE_URL}/propiedad/{code-lowercase}` (sin params), `is_web_published(prop)` (activa/reservada/vendida + no archivada + canal `web-varela` = `published`), `public_url_or_none(prop)`. La versión con tracking (`public_url`) ahora deriva de la canónica.
- **Modelo**: `PropertyResponse.publicUrl` (camelCase, `Optional[str]`), seteado en `serializers.property_to_response` vía `inquiries.public_url_or_none` (import diferido para evitar ciclo). `= null` si no está publicada. `routes_public` (listings/detail/inquiry) también expone la canónica limpia en `publicUrl`.
- **Frontend**: acción **"Compartir"** en el menú "…" de la card (`menu-share-{id}`) → copia `property.publicUrl` al portapapeles + toast `✅ Propiedad lista para compartir`. NO abre WhatsApp ni pestañas. Si `publicUrl == null` → entrada deshabilitada (`menu-share-disabled-{id}`) con "Esta propiedad todavía no posee una URL pública." Tipo `Property.publicUrl?: string|null`. Fallback `execCommand('copy')` si no hay Clipboard API.
- **Arquitectura**: ningún componente construye la URL ni hardcodea dominio; todo consume `property.publicUrl`. Dominio desde `config.PUBLIC_WEB_BASE_URL`; segmento de ruta `/propiedad/{code}`.
- **Open Graph — LIMITACIÓN IMPORTANTE**: se agregó inyección client-side de `og:title/description/image/url` + Twitter Cards en la página pública interna `/web/:id` (`PublicPropertyDetail`, usando la URL canónica). PERO los crawlers de WhatsApp/Telegram/Facebook/LinkedIn **NO ejecutan JS**, así que la vista previa al pegar el link **requiere SSR/prerender en el sitio público externo** (varelapropiedadescde.com.ar), que está fuera de este entorno y es responsabilidad del sitio público (como aclaró el usuario). La URL canónica ya queda lista para que ese sitio la sirva con OG server-side.
- **Base para el futuro** (todo reutiliza la misma `publicUrl`): Generar QR, Compartir desde Studio, emails automáticos, landing pages, campañas, compartir con Personas, tracking de enlaces.



## Fixed/Refactored (Sprint "URL pública — fuente única de verdad" — 2026-07)
Corrige el 404 del sprint anterior (`/propiedad/{code}` no existe en el sitio público estático). Verificado 100% por testing agent (iteration_35): backend 10/10 pytest + frontend. Doc oficial: `/app/docs/architecture/publication-pipeline.md`.
- **Regla de arquitectura (invariante)**: la ÚNICA fuente de verdad de la URL pública es `publications['web-varela'].url`. Ningún componente construye/infiere la URL por convención. Eliminadas `inquiries.canonical_url`/`public_url_or_none`.
- **`property.publicUrl`** deriva exclusivamente de `web_publisher.stored_public_url(prop)` = `publications['web-varela'].url` si `status=='published'` y hay url; si no → `null` (también `null` si `inconsistent`).
- **Pipeline escribe la url SIEMPRE**: al publicar (`set_publication`), al re-sincronizar (`PATCH` auto re-sync ahora persiste `.url`) y al importar (`legacy_import._map_publications`). Formato: `https://www.varelapropiedadescde.com.ar/?propiedad=<idPúblico>` (idPúblico = `legacy_id` del CRM o `vera-<uuid>`).
- **Validación de integridad**: `web_publisher.publish()` hace upsert + `_row_exists()` (verifica que la fila quedó en el CRM). Si falla → `logger.error`, `status='inconsistent'`, `url=''`, `publicUrl=null` (sin botón Compartir). "Preferimos sin botón que con link roto."
- **Backfill** (`backend/scripts/backfill_public_url.py`): corrida única → **28 corregidas, 0 inconsistentes, 1 ya OK** (29/29 con url válida verificada contra el CRM).
- **WhatsApp/consultas** (`inquiries.public_url`) ahora DERIVA de `stored_public_url` + tracking (`source=website`), sin construir.
- **Frontend**: "Compartir" ya consumía `property.publicUrl` (sin cambios); ahora copia la URL correcta (`?propiedad=<id>`).
- **Deuda menor futura**: `serializers._property_code` cae a `VAR-000000` en uuid inválido (log/raise defensivo).



## Implemented (Sprint "Documentos v1 — Arquitectura Fundacional" — 2026-07)
Motor documental de VERA (los documentos son entidades del negocio, no PDFs). Objetivo del sprint: modelo de datos + relaciones + scaffolding. NO se implementó: generación de PDF, migración de pantallas, lógica de firma, automatizaciones, integración Knowledge (solo preparada). Doc oficial: `/app/docs/architecture/documents-module.md`.
- **4 entidades** (Supabase/Postgres): `document_templates` (versionado inmutable por `template_key`+`version`), `documents` (instancia atada a una versión + `template_snapshot` congelado), `document_relationships` (polimórfica: property|person|opportunity|task + `role`), `document_signatures` (múltiples firmantes, cada uno = Persona). DDL: `backend/documents/schema.sql`.
- **Campos aprobados**: Document con `category`, `origin`, `locked_at`, `document_hash` (sha256 snapshot+resueltas), `pdf_status` (separado del `status`), `resolved_variables`, `template_version`.
- **Ciclo de vida único**: draft→generated→shared→signed→archived (transiciones validadas). **Historial como eventos** en el ledger MongoDB existente (`documents/events.py` → `events.pipeline.emit`, tipos `document.created/edited/generated/shared/signed/archived`). `events.store.list_by_document` para el timeline. Integración Knowledge preparada (un `document.signed` ya es evento).
- **Backend módulo independiente** `backend/documents/`: `models.py`, `repository.py`, `service.py`, `events.py`, `api.py`. Router montado en `/api/documents` (templates + documents + relationships + signatures, CRUD básico + versionado + transiciones). Validación: un documento nunca queda aislado (≥1 relación); bloqueo de edición si `locked_at`.
- **Frontend scaffolding**: feature flag `documentos`, item de nav "Documentos", ruta `/documentos`, pantalla `DocumentsScreen` con tabs Documents/Templates (`useDocuments.ts`, `TemplatesList`, `DocumentsList`). Solo navegación/listado (sin formularios/PDF).
- **PENDIENTE (bloqueante para CRUD)**: crear las tablas en Supabase. No hay acceso DDL desde el código (`DATABASE_URL` vacío; solo PostgREST). El usuario debe ejecutar `backend/documents/schema.sql` una vez en el SQL editor de Supabase. Tras eso, testear CRUD E2E con testing_agent.
- **VERIFICADO (2026-07)**: usuario ejecutó el DDL en Supabase. CRUD E2E testeado por testing_agent (iteration_36): backend **17/17** pytest (templates + versionado + snapshot congelado en v1 aunque exista v2 + ciclo de vida + document_hash + locked_at + historial por eventos + relationships + signatures). Bug de contrato corregido: los endpoints `/api/documents/*` devolvían snake_case; ahora serializan camelCase vía `documents.models.to_api_*` (`Model(**row).model_dump(by_alias=True)`). Frontend verificado (meta completa + versionado visible).
- **Próximo sprint (no ahora)**: resolución de variables desde Personas/Propiedades + generación de PDF + firmas + projection handler de Knowledge para `document.signed`.


## Implemented (Sprint "Tasador Online público — híbrido Varela + ML en vivo" — 2026-06)
Segunda mitad del módulo Tasaciones: capturador de leads web público. Verificado E2E (curl + screenshot: form + resultado, lead creado en Personas y luego limpiado, tsc limpio).
- **Ruta pública `/tasar`** (`app/public/TasarPublico.tsx`, sin auth): un visitante estima su casa/lote/depto en Costa del Este y queda como **Lead (rol vendedor)** en Personas. Branding Varela (reusa shell `.vera-pub*` + estilos `.tasp*`). Form de baja fricción → resultado con rango grande + referencia de mercado + CTA "un asesor te contacta".
- **Modelo HÍBRIDO** (`backend/tasacion_online.py`): `tasar()` Varela (matemática intacta) + comparables EN VIVO de Mercado Libre. Blend = promedio(mid publicación Varela, medianPm2×superficie) ± 7% redondeado a 500. Si hay <4 comparables, cae a rango Varela puro (`method: "varela"` vs `"hibrido"`).
- **Comparables ML** (`backend/mercadolibre/comparables.py`): la API oficial `/sites/MLA/search` devuelve **403 aun con token de vendedor** (ML la restringió). Solución: **scraping del sitio público** `inmuebles.mercadolibre.com.ar` (parse por tarjeta poly-card: precio USD + m² cubiertos/totales), mediana con recorte de outliers, caché en memoria TTL 6h. Aislado: si ML habilita API oficial, se cambia solo este módulo. Verificado: 48 comparables casa Costa del Este → mediana USD 1.492/m².
- **Endpoints públicos** (`backend/routes_tasacion_online.py`, prefix `/api/public/tasacion`): `POST /estimar` (calcula + crea lead vía `person_resolver` + evento `TasacionSolicitada` con contexto) y `GET /mercado?tipo=` (precio/m² promedio en vivo). Lead sólo si Supabase configurado y hay teléfono/email.
- **Acceso desde VERA**: `TasacionesScreen` (interno) suma bloque "Tasador online público" con botón **Copiar link público** (`/tasar`).
- Archivos nuevos: `mercadolibre/comparables.py`, `tasacion_online.py`, `routes_tasacion_online.py`, `app/public/TasarPublico.tsx`. Router registrado en `server.py`. Rol del lead: `vendedor`.

## Fix + feature (Tasador — 2026-06)
- **JPG con acentos rotos (□) en producción**: la fuente Liberation no estaba garantizada en el contenedor deployado → caía a una sin glifos (Ú, ó, ², "–"). Fix: se incluye la fuente en el repo (`backend/assets/fonts/LiberationSans-Regular/Bold.ttf`) y `routes_tasacion.py` la carga desde ahí (viaja al deploy). Verificado: JPG renderiza "MAR DEL TUYÚ / TASACIÓN / 550 m² / USD 102.000 – 111.000" correcto. **Requiere REDESPLEGAR para verse en prod.**
- **Variables editables del cálculo**: nuevo panel `TasadorConfig.tsx` en `TasacionesScreen` (toggle "Ajustar variables del cálculo") que edita las **51 variables** del modelo Varela (coef. de cierre, apertura, precios construcción por zona×calidad, precios lote, precios depto, multiplicadores antigüedad/estado/servicios/vista, adicionales) agrupadas y etiquetadas. Consume `GET/PUT /api/tasacion/config` (ya existía). Guardar persiste en Mongo `tasador_config` y afecta al instante manual + online. Verificado (51 inputs, PUT persiste).

## Feature (Aviso al propietario de visita — acceso rápido + WhatsApp + mensaje con onda — 2026-06)
Mejora pedida por el usuario: el aviso al propietario estaba enterrado al final del workspace y el mensaje era muy básico.
- **Acceso desde la lista** (`PropertiesScreen`): botón **"Visita"** (píldora amarilla, ícono ClipboardCheck) en cada card (abajo-der, oculto en archivadas) + ítem **"Registrar visita"** en el menú de los 3 puntitos. Ya no hay que entrar y bajar hasta el final.
- **`VisitModal` reutilizable** (`property-workspace/VisitModal.tsx`): único modal usado por la lista y el workspace. Trae nombre+teléfono del propietario vía `peopleService.get(ownerId)`. Si hay teléfono → box verde "Enviar WhatsApp al propietario" (nombre · teléfono) + checkbox "Enviar"; al registrar abre `wa.me/{telefono}?text=…` con el mensaje precargado. Si no hay teléfono → genera el mensaje y lo muestra para copiar. VERA nunca envía sola.
- **Mensaje con más onda** (`buildOwnerMessage` en `visit-service.ts`): saludo por nombre del propietario, tono cálido rioplatense con emojis, mantiene anónimo al interesado, incluye comentario opcional y firma con el agente ("… · Inmobiliaria Varela"). Nuevo helper `whatsappLink(phone, message)`. Comentario relabelado "Comentario para el propietario" (se incluye en el aviso).
- `Property` type suma `ownerId?` (el backend ya lo devolvía en camelCase). `TrackingSection` refactorizado para usar el modal compartido (mantiene stats + timeline). Verificado E2E (screenshot: card con botón Visita, modal con Eduardo Ocampos · 5492246502789), tsc limpio.

## Fix (Radio se cortaba al cambiar de pantalla — 2026-06)
El `<audio>` vivía dentro del `AudioWidget` (solo en "Hoy"), así que al navegar a otra ruta el componente se desmontaba y la radio se cortaba. Fix: nuevo `AudioPlayerProvider` (`app/workspace/AudioPlayerContext.tsx`) que monta el `<audio>` + el estado (station/playing/volume) UNA vez en `AppLayout` (no se desmonta al navegar). `AudioWidget` pasó a ser solo un control que consume `useAudioPlayer()`. Verificado: 1 elemento `<audio>` presente en /hoy, /propiedades y /personas → la radio sigue sonando al cambiar de pantalla. tsc limpio.

## Ajuste mensaje al propietario (2026-06)
`buildOwnerMessage` actualizado al formato pedido: se presenta como "Soy Vera, la asistente virtual de {agente}", usa "hoy/ayer/el DD/MM/AAAA" según la fecha real de la visita (nuevo helper `visitWhen`), sin firma al final. Toma el nombre del agente del campo Agente del formulario.

## Fix (Publicar en ML fallaba — "Currency USD is invalid" en terrenos — 2026-06)
Causa raíz: la resolución de categoría de ML estaba mal. (1) `domain_discovery` devolvía categorías que NO son inmuebles para queries como "terreno en venta" → "Escenografía y Terrenos" (solo ARS) → error de moneda. (2) El fallback tenía IDs incorrectos (terreno → MLA50541 = Cocheras). (3) Faltaba bajar hasta la categoría HOJA ("Propiedades Individuales").
Fixes en `mercadolibre/service.py`:
- Eliminado `domain_discovery`; `_CATEGORY` ahora mapea a las categorías HOJA correctas del árbol Inmuebles (MLA1459), todas aceptan USD+ARS. Terreno venta = MLA401687, casa = MLA401685, depto = MLA401686, etc.
- `_ATTR_DEFAULT`: agrega atributos obligatorios que VERA no modela. Terrenos requieren LAND_ACCESS → default "Asfalto" (245046).
- Bug de unidad: `number_unit` tomaba `allowed_units[0]` que para terrenos era "ha" → un lote de 419 m² se publicaba como "419 ha". Ahora prefiere "m²".
Verificado con `POST /items/validate` de ML (no crea avisos reales): terreno f4678842 → 204 OK (419 m², acceso Asfalto), casa venta → 204 OK. **Requiere REDESPLEGAR para arreglar producción.** Nota: LAND_ACCESS por defecto "Asfalto"; el usuario puede editarlo en ML si el lote es de ripio/arena.

## Rediseño Tasador Manual (JPG + formulario — 2026-07)
Pedido del usuario: JPG muy básico/feo, fondo negro, sin logo Varela, mostraba datos internos.
- **JPG rediseñado** (`routes_tasacion.py`): paleta clara/crema premium (no más negro), acento amarillo Varela. Quitados datos internos: ya NO muestra la zona ("Zona Fondo") ni el "Coeficiente de cierre 83%". Ahora muestra: dirección, TIPO (Casa), desglose de m² (cubiertos · semicubiertos, terreno) y dormitorios · baños. Card blanca con borde dorado para "VALOR RECOMENDADO VARELA", card de referencia (promedio portales), nota "orientativos sujetos a verificación", firma del asesor.
- **Logo Varela**: header preparado — si existe `backend/assets/brand/varela-logo.png` lo inserta; si no, cae al wordmark tipográfico "VARELA PROPIEDADES". PENDIENTE: el usuario debe subir su logo PNG (aún no llegó; los adjuntos recientes eran capturas).
- **Formulario** (`TasacionesScreen.tsx`): nuevos campos Semicubierto (m²), Dormitorios y Baños. Son informativos para la ficha, NO cambian el precio (el usuario ya suma el semicubierto al 50% manualmente en "Construido"). Algoritmo Varela intacto. Cochera se mantiene como estaba (tildes Estac. cubierto/descubierto).
- Nuevos campos en JpgBody: semicubiertos, dormitorios, banos. Verificado: JPG generado OK + tsc limpio + form renderiza los 3 campos.

## Logo Varela en el JPG (2026-07)
El usuario subió su logo (JPEG amarillo sobre blanco). Como amarillo sobre crema no se lee, lo procesé a **monocromo oscuro (ink)** recortando el fondo blanco (alpha = 255-min(r,g,b)), guardado en `backend/assets/brand/varela-logo.png` (RGBA, 611×293). El endpoint `/jpg` ya lo detecta y lo inserta en el encabezado (target 400px, centrado); si no existe cae al wordmark.
También se corrigió el layout del JPG: ahora es DINÁMICO (cursor que fluye) para que el logo más alto no empuje las líneas de terreno/dormitorios/baños detrás del recuadro de precio. Verificado con logo real: se ven todas las líneas, diseño balanceado.
Nota: el logo se muestra en oscuro (no en su amarillo original) por legibilidad sobre el crema; se puede cambiar el tratamiento si el usuario prefiere otro.

## Campo "radar" (destacada en portada del sitio público) — 2026-08
Traído del fork GitHub viejoskill/vera-os@8976683. Aplicado MANUALMENTE (sin git pull, para no chocar con los commits de la plataforma). La columna `radar boolean default false` ya existe en Supabase (migrada por fuera). 8 archivos:
- Backend: `schemas.py` (radar en PropertyCreate=False / PropertyUpdate=Optional / PropertyResponse=False), `serializers.py` (radar en property_to_response), `routes_properties.py` (data["radar"]=False al duplicar), `supabase_schema.sql` (bloque idempotente doc).
- Frontend: `property.ts` (radar?: boolean), `form-schema.ts` (z.boolean() + default false), `PropertyWorkspace.tsx` (toForm + buildPayload), `BasicInfoSection.tsx` (toggle "En Radar — destacada en la portada del sitio", estilo vera-amenity, antes de ubicación, data-testid="toggle-radar").
Verificado: modelos Pydantic OK, tsc limpio, round-trip E2E real (PATCH radar=true → GET=true → revert=false) contra la API → la columna existe en este entorno. Toggle renderiza y alterna en el editor.

## Template "Recibo de Seña (Reserva)" en Documentos — 2026-08
Pedido pendiente: sumar el modelo de reserva del usuario (PDF) como plantilla completable.
- Seed nuevo `scripts/seed_recibo_sena.py` (mismo patrón que `seed_autorizacion_venta.py`). Template `recibo_sena_reserva` v1, categoría `reserva`, status active, firma digital+presencial.
- 13 variables: fecha (system); ciudad/provincia (input, defaults Costa del Este/Buenos Aires); comprador_nombre/dni/domicilio/telefono (person role=comprador, auto); inmueble_ubicacion (property address, auto); inmueble_descripcion + nomenclatura_catastral (input); monto_sena/precio_total/honorarios (input money). Martillero Jorge Oscar Varela y escribana Nancy Cecilia Moal quedan FIJOS en el body (fiel al PDF).
- Verificado E2E: motor valida obligatorios (rechazó sin comprador_dni), documento creado con property+comprador+inputs, PDF generado (HTTP 200) y texto extraído = fiel al modelo (comprador, inmueble, montos USD, cláusulas, jurisdicción Dolores). Aparece en la UI de Documentos. Documento de prueba archivado.
- Para recargar en producción tras deploy: `python -m scripts.seed_recibo_sena` (o correrlo apuntando SEED_API a prod). NOTA: el seed corre contra la API; en este entorno ya quedó cargado en Mongo.

## Reserva: comprador nuevo + multi-comprador + cláusulas editables — 2026-08 (Opción B)
- **Cláusulas editables** (template `recibo_sena_reserva` v2, `scripts/seed_recibo_sena.py`): forma_pago, honorarios_gastos, escrituracion (escribano), entrega_estado, jurisdiccion pasan a variables input textarea con el texto original PRECARGADO como default (editable por reserva). Martillero Jorge Oscar Varela sigue fijo.
- **Multi-comprador**: `documents/resolver.py` ahora agrupa MÚLTIPLES personas por rol (persons_by_role: list) y agrega los valores con " y " (ej. "Juan Pérez y María Gómez", "DNI 30111222 y 30333444").
- **Alta rápida + multi-selección** en `DocumentWizard.tsx`: `personByRole` → `personsByRole: Record<string,string[]>`. Paso Personas: chips de seleccionados (removibles) + select "Agregar de la base…" + botón "＋ Nuevo" con form inline (nombre*, DNI, teléfono, email) que crea la persona vía `useCreatePerson` (queda como Lead en el CRM con el rol) y la vincula. canAdvance exige ≥1 por rol requerido. Firmantes derivan de todas las personas → multi-firmante.
- Verificado E2E: PDF con 2 compradores agregados + cláusula jurisdicción editada ("Tribunales de Mar del Plata (EDITADO)"); tsc limpio; screenshot del paso Personas con multi-select + quick-add OK. Datos de prueba limpiados.
- NOTA: el picker de templates lista cada versión como card (v1 y v2 de Reserva aparecen ambas) — comportamiento preexistente del wizard, no introducido acá. La v2 es la vigente.

## Correcciones "Recibo de Seña" (PDF) — 2026-06
Ajustes de generación en `/app/backend/documents/pdf.py` (solo render, sin re-seed):
- **Logo Varela en negro** en TODOS los PDF: `_black_logo_bytes()` convierte `assets/brand/varela-logo.png` (RGBA) a silueta negra pura (alpha preservado, cacheada). Ideal para impresión B&N. Reemplaza el path viejo inexistente `documents/assets/varela_logo.png` que caía al wordmark.
- **Separador de miles por tipo `money`**: `_display_vars(resolved, variables)` ahora formatea toda variable declarada `type: money` en el template (monto_sena, precio_total, honorarios → 150.000 / 1.250.000 / 37.500), además de las claves legacy. Genérico para documentos futuros.
- **Firma fija del asesor**: bloque "Asesor de venta: Sebastian Varela" SOLO en el template `recibo_sena_reserva` (via `document.template_key`).
- Verificado por script local: PDF generado OK, texto extraído confirma miles + firma; logo negro puro (0,0,0) 611x293.

## Ocultar versiones viejas en "Nuevo documento" — 2026-06
- `DocumentWizard.tsx`: `availableTemplates` (useMemo) muestra SOLO la última versión por `templateKey` (excluye status deprecated/archived). El selector deja de repetir v1/v2. La solapa Templates (gestión) sigue mostrando todas las versiones.
- Verificado E2E (screenshot login qa_varela): "Recibo de Seña (Reserva)" ahora muestra solo v2. tsc limpio.

## Buscador de propiedad en "Nuevo documento" — 2026-06
- `DocumentWizard.tsx`: paso 2 (Propiedad) ahora tiene un `Input` de búsqueda (`wizard-property-search`) que filtra client-side por code/title/address/neighborhood/city, insensible a acentos (`filteredProperties` useMemo). Empty state con el término buscado. CSS `.vera-wizard__search`.
- Verificado E2E (screenshot): con "costa" filtra 30→29. tsc limpio.

## Limpieza de documentos + botón eliminar — 2026-06
- **Botón eliminar** por fila en la lista de Documentos (`DocumentsList.tsx`): ícono papelera con confirmación (`window.confirm`), estado de carga, y refresco automático (`useDeleteDocument` invalida `["documents"]`). La fila pasó de `<button>` a `<div>` con área clickeable (`vera-docs__rowmain`) + badge + botón borrar (`vera-docs__delete`). CSS agregado.
- **Backend**: `DELETE /api/documents/{id}` → `service.delete_document` → `document_repository.delete` (los hijos relationships/participants/signatures caen por ON DELETE CASCADE). Verificado por curl (204 → 404).
- **Limpieza**: eliminados los 52 documentos de prueba restantes; la lista quedó vacía. Verificado E2E (screenshot: crear fila de prueba → botón papelera visible → borrar → estado vacío).
- NOTA: la limpieza de datos ya impacta en producción (Supabase compartido). El botón eliminar es cambio de código → requiere **redeploy** para verse en producción.

## Actualización HTML Vera Studio (V1) — 2026-06
- Reemplazado `/app/frontend/public/vera-studio.html` con el nuevo artifact del usuario (Vera OS Studio -V1), ~140KB.
- Reinyectado el puente de persistencia (`scripts/inject_studio.py`) → sobrescribe `window.storage` y guarda estado en `/api/studio/kv/{key}?u=<userId>` (sincroniza entre PCs; fallback localStorage sin usuario).
- Verificado E2E: iframe `/vera-studio.html?u=<uid>` carga con title "VERA OS STUDIO", nueva UI (pestañas Carrusel/Post/Calendario/Video/Editor, preview con marca Varela).
- NOTA: el HTML vive en public/ → en Preview se sirve directo; en producción requiere **redeploy**.

## Template "Aceptación de Oferta" — 2026-06
- Seed `/app/backend/scripts/seed_aceptacion_oferta.py` (templateKey `aceptacion_oferta`, categoría `oferta`, v1 activo). Fiel al PDF del usuario.
- Persona rol `propietario` (elegir de la base o alta rápida desde el wizard). Variables editables: precio_convenido, pago_escritura, escrituracion (default escritura traslativa/Moal/60 días), honorarios (default martillero Varela a cargo del comprador), observaciones (condicional notEmpty). Montos tipo money → separador de miles.
- `pdf.py`: bloque de firma fijo por template vía `_FIXED_SIGNATURES` (recibo_sena_reserva → asesor Sebastian Varela; aceptacion_oferta → INMOBILIARIA VARELA COSTA DEL ESTE / Jorge Oscar Varela). Firma del vendedor sale por el motor de participantes.
- Verificado: seed OK, PDF (pdfminer) con todos los campos y miles; screenshot wizard muestra el template en el selector.

## Bugfix: guardado silencioso + lentitud/cuelgue de propiedades — 2026-06
- **Causa #2 (no guardaba título/descripción):** `ApiPropertyRepository.update` tragaba el error y devolvía null → `handleSave` mostraba "Guardado" falso aunque el PATCH fallara. Ahora `update` NO traga (lanza) → la UI muestra "No pudimos guardar. Reintentá" y no pierde datos en silencio. Fotos usan path live aparte (por eso se veían pero el título no).
- **Causa #3 (se cuelga al abrir/cargar):** endpoints lentos por N+1 secuencial firmando Signed URLs (lista 10,5s, detalle 3,7s). Fix: `asyncio.gather` en `list_properties` (routes_properties) y en `property_to_detail` (serializers) + **cache TTL en memoria** de Signed URLs (`_SIGN_CACHE`). Resultado: lista 0,6s cacheada / detalle 0,75s. Se agregó timeout de 30s en `ApiPropertyRepository.request` (AbortController) para que cuelgues se conviertan en error visible.
- Verificado E2E (preview): workspace carga rápido; editar título + Guardar + reload → persiste.
- PENDIENTE user: #4 (dónde ve "similares" sin RESERVADA) y #5 (auto-sync Web+ML al Guardar).

## Auto-sync Web+ML al Guardar + fix #4 similares — 2026-06
- **#5 (auto-publicar al Guardar):** `update_property` (routes_properties) ahora re-sincroniza **Web Varela ‖ Mercado Libre en paralelo** (asyncio.gather) en cada PATCH, con un único write de `publications`. Web ya existía; se agregó `ml_resync_patch` (routes_ml) que actualiza el aviso ML (título/precio/desc/fotos) si ya tiene itemId. Helpers: `_web_resync_patch` (routes_properties), `ml_resync_patch` (routes_ml). `web_publisher._photo_urls` ahora firma en paralelo. Verificado: PATCH → web:published, ml:published, ~6,6s (antes 9,4s secuencial).
- **#4 (reservada no se actualiza en similares):** al cambiar estado, el update dispara el re-sync web → estado "Reservada" se empuja a la tabla `propiedades` del CRM que lee la web. Con el fix de guardado silencioso (frontend), el cambio de estado ahora llega de verdad al backend. LÍMITE: el bloque "Otras propiedades similares" lo renderiza el sitio EXTERNO varelapropiedadescde.com.ar (no está en este repo); excluir del todo las reservadas de similares requiere tocar el código de ese sitio. Lo que sí queda: el estado se propaga correcto.
- NOTA: durante testing quedó bathrooms=2 en la propiedad 9fd023a5 (real). Título restaurado.

## Pausar ML al reservar + cartelito de sincronización — 2026-06
- **Pausar ML:** `mercadolibre/service.py` nuevo `sync_status(item_id, desired)` (pausa/reactiva solo si difiere y el item es editable). `ml_resync_patch` (routes_ml) calcula desired="paused" si status∈{reserved,sold}, "active" si Disponible, y lo aplica tras actualizar el aviso. Al reactivar vuelve a active. Verificado camino active (queda active, sin error).
- **Cartelito sincronización:** nuevo `SyncBadge.tsx` (property-workspace) en el header, junto a Guardar. Chips Web/ML verdes "✓ Hace X" (published) o ámbar (inconsistent/error), leyendo `detail.publications` (se refresca por invalidación de ["property", id] tras Guardar). CSS `.vera-sync-badge/.vera-sync-chip`. Verificado E2E (Web ✓ / ML ✓).

## Fix pantalla negra al abrir propiedad (Google Translate) — 2026-06
- Síntoma: en la PC de escritorio (Chrome con traductor activo, "Se ha traducido al español") la ficha de propiedad quedaba en negro; en la notebook (sin traductor) andaba bien. Causa: Google Translate muta los nodos de texto y rompe la reconciliación de React → crash en la vista de detalle.
- Fix en `frontend/public/index.html`: `<html lang="es" translate="no">` + `<meta name="google" content="notranslate">`. La app ya está 100% en español, así que desactivar la traducción no tiene contra.
- Verificado: la propiedad 9c1d4217 abre perfecta en Preview. Usuario confirmó que era el traductor.
- Requiere **Deploy** (cambio en HTML base). Workaround inmediato en la PC: desactivar "traducir siempre este sitio" en Chrome.

## Reactivar ML (1 clic) + Error Boundary — 2026-06
- **Reactivar ML:** nuevo `POST /api/ml/listings/{id}/reactivate` (routes_ml) → `ml.sync_status(item_id, "active")`, sin tocar el estado de la propiedad. Frontend `ChannelsSection.tsx`: botón "Reactivar" (data-testid reactivate-mercadolibre) visible solo si `mlLive.status==="paused"`; invalida ["ml-state", id] al éxito. Verificado endpoint 200 → active.
- **Pantalla de respaldo:** nuevo `app/ErrorBoundary.tsx` (class component, getDerivedStateFromError) envuelve <VeraOS/> en index.tsx. Muestra card con botón Recargar + tip del traductor en vez de pantalla negra. CSS `.vera-fallback*`. Verificado: transparente en operación normal.
- Requiere Deploy para producción.

## Placa VENDIDA/RESERVADA en tablero + foto con sello (descarga + ML) — 2026-06
- **Parte 1 (tablero):** sello diagonal en las tarjetas de la grilla `PropertiesScreen.tsx` (const STAMP + overlay `.vera-pub-stamp--card`), reutiliza el estilo de la web. VENDIDA amarillo / RESERVADA rojo. Verificado.
- **Parte 2 (foto con sello):** nuevo `backend/property_stamp.py` (Pillow): `render_stamped_cover` quema el sello diagonal (fuente LiberationSans-Bold) + logo Varela en BLANCO con sombra, misma estética que la web. `get_stamped_cover_bytes` (descarga portada) y `stamped_cover_url` (sube a `property-images/stamped/{id}-{status}.jpg` con upsert + URL firmada larga para ML). Se agregó `upsert` a `storage_service.upload`.
  - Endpoint `GET /api/properties/{id}/stamped-cover?status=` → JPEG attachment. Botón "Foto con sello" en el header del workspace (data-testid download-stamped-cover), visible si status∈{sold,reserved}.
  - **ML:** `ml_resync_patch` ahora, si status∈{sold,reserved}, publica la portada con sello primero (`_stamped_images`) y YA NO auto-pausa (decisión del usuario: dejar activo con sello; pausar manual con Finalizar/Reactivar). La portada ML se actualiza en el próximo Guardar de la propiedad.
- Verificado: imagen generada (se ve el sello + logo), endpoint 200, upsert overwrite OK, botón visible en ficha. Requiere Deploy para producción.

## Compartir directo la foto con sello — 2026-06
- Nuevo `StampShareButtons.tsx` (property-workspace): botones "Foto con sello" (descarga) + "Compartir" (verde WhatsApp). Compartir usa Web Share API (`navigator.share({files})`) → en móvil abre el share sheet con la imagen adjunta (WhatsApp/IG); fallback desktop: `wa.me/?text=` con título/dirección + link a la imagen. Visible solo si status∈{sold,reserved}. CSS `.vera-stamp-share`.
- Verificado: ambos botones renderizan en la ficha. Requiere Deploy para producción.

## Sello en Web + compartir ficha + formato historia — 2026-06
- **Sello en la Web:** `web_publisher._photo_urls` antepone la portada con sello (via `property_stamp.stamped_cover_url`) cuando status∈{sold,reserved}; reemplaza la portada original. Se aplica en el próximo Guardar (re-sync web). ML ya lo hacía.
- **Formato historia (9:16):** `property_stamp.render_story`/`get_story_bytes` (1080x1920: logo Varela, foto con sello sin logo duplicado, precio en amarillo, título, dirección, footer web). Endpoint `GET /api/properties/{id}/story?status=`. Botón "Historia" en `StampShareButtons`.
- **Compartir ficha completa:** nuevo `ShareListingButton.tsx` comparte `detail.publicUrl` (canónico) por share nativo / wa.me. Visible cuando hay publicUrl.
- `render_stamped_cover(with_logo=)` para no duplicar logo en historia. Verificado: web stamped url OK, story 1080x1920 se ve pro, 4 botones renderizan. Requiere Deploy.

## Correcciones al compartir + menú agrupado — 2026-06 (testeado iteration_41)
- **Bug link/miniatura:** nuevo `GET /api/properties/{id}/share` (routes_properties) → HTML con OG tags por propiedad (og:title, og:description precio+dirección, og:image portada/portada con sello, og:url = {site}/web/{id}) + redirect (meta refresh + window.location.replace) a la ficha pública propia `/web/{id}`. Corrige: el link ahora abre la propiedad (no la home externa) y la miniatura muestra foto+título (no "CRM Varela"). Fix 500→404 en UUID inválido.
- **Agrupar botones:** nuevo `ShareMenu.tsx` (dropdown) reemplaza StampShareButtons/ShareListingButton (borrados). Un solo botón "Compartir" con: Compartir ficha (siempre) + Foto con sello/Historia 9:16/Compartir foto (si sold/reserved). Header despejado.
- Verificado por testing_agent (iteration_41): backend OG+redirect OK, /web/{id} renderiza la propiedad, menú agrupado OK. frontend 100
## Correcciones al compartir + menú agrupado — 2026-06 (testeado iteration_41)
- Bug link/miniatura: nuevo GET /api/properties/{id}/share (routes_properties) -> HTML con OG tags por propiedad (og:title, og:description precio+direccion, og:image portada/portada con sello, og:url = {site}/web/{id}) + redirect (meta refresh + window.location.replace) a la ficha publica propia /web/{id}. Corrige: el link abre la propiedad (no la home externa) y la miniatura muestra foto+titulo (no "CRM Varela"). Fix 500->404 en UUID invalido.
- Agrupar botones: nuevo ShareMenu.tsx (dropdown) reemplaza StampShareButtons/ShareListingButton (borrados). Un solo boton "Compartir": Compartir ficha (siempre) + Foto con sello/Historia 9:16/Compartir foto (si sold/reserved). Header despejado.
- Verificado por testing_agent (iteration_41): backend OG+redirect OK, /web/{id} renderiza la propiedad, menu agrupado OK, frontend 100%.
- Requiere Deploy para produccion.

## Implemented (Historia 9:16 con placa de marca + Oswald — 2026-06)
- `render_story()` (`property_stamp.py`) reescrita: usa la placa base oficial `assets/brand/story-base.jpg` (logo VARELA + linea amarilla + puntos ya incluidos) como fondo en vez de color solido.
- Foto de la propiedad ahora en **16:9 grande** (cover-fit + esquinas redondeadas) con sello VENDIDA/RESERVADA quemado, ubicada bajo el logo (y=400).
- Textos con **Oswald**: Precio (Bold 128, amarillo #F6E63A), Titulo (Medium 58, mayusculas, blanco, 2 lineas), Direccion (Light 48, gris). Pie web (Regular 36) debajo de la linea amarilla (y=1589).
- Fonts en `assets/fonts/Oswald-*.ttf`. Fallback a color solido si falta la placa.
- Verificado visualmente (render de prueba con foto real). Endpoint `/api/properties/{id}/story` usa la nueva logica (hot reload).

## Implemented (Web externa — Hero Radar Showcase — 2026-06)
- **Sitio externo** `varelapropiedadescde.com.ar` (NO está en este repo; el usuario pasó `index.html`). Se reemplazó el mockup estático del dashboard en el hero por un **showcase de propiedades del Radar**.
- Nuevo `#hero-showcase` + funciones JS `renderHero/heroSlideHTML/heroShow/heroGo/heroSet`: toma `todasProps.filter(p => p.radar)` (mismo flag `radar` que ya cura la sección Radar), muestra 1 propiedad a la vez (foto full-bleed, badge RADAR, badge Reservada/Vendida, tipo·operación, título, ubicación, features dorm/baños/m², precio, CTA "Ver propiedad"), **rota automáticamente cada 5s** con fade, flechas + dots, pausa al hover, click abre `abrirFicha(id)`. Fallback: si no hay radar, usa las 5 últimas activas.
- **Selección manual = flag `radar` por propiedad** (ya existente). CSS `.hero-showcase/.hs-*` agregado al `<style>`.
- Verificado E2E (screenshot con datos reales de Supabase): 4 propiedades radar, rotación + navegación OK.
- **Entrega**: archivo final en `/app/frontend/public/varela-index.html` (descargable desde el preview). El usuario lo sube a su host externo.

## Implemented (VERA Brain — Modo Studio / directora creativa de contenido — 2026-06)
- **Nuevo modo "Studio"** en VERA Brain (mismo motor Claude, memoria multi-turno y Knowledge Hub). Personalidad de directora creativa de contenido para la inmobiliaria: propone carruseles, posts, historias, reels y **videos para TikTok**, con impronta anti-genérica.
- Backend: `vera_brain/studio.py` (`STUDIO_IDENTITY` con el loop: preguntar antes → generar en bruto → filtrar → entregar 3-5 ideas TOP con hook/mini-guion de tomas/CTA → SIEMPRE sección "Extra/arriesgadas" → iterar). `brain._system(mode)` y `brain.ask(q, session_id, mode)` eligen identidad Vera/Studio; `AskRequest.mode` en `routes_brain`. Conoce la cartera real (Knowledge Hub) y la voz de marca; marca "verificar" en lugar de inventar.
- Frontend (`VeraChat.tsx` en "Hoy"): toggle segmentado **VERA ⟷ Studio** en el header, sesión separada por modo (prefijo `vera-{mode}-`), saludo/sugerencias/placeholder propios de Studio, y **botón "Copiar"** por respuesta. `brain-gateway.ask(...)` acepta `mode`. CSS `.vera-chat__modes/.vera-chat__mode/.vera-chat__copy`.
- Verificado E2E: curl (2 turnos: preguntó primero conociendo la casa real "Los Cedros 1015 · USD 129.000 · 14 fotos", luego entregó ideas de reel/TikTok con guion toma por toma + Extra) + screenshot del toggle en la UI. tsc limpio, backend OK.

## Implemented (Studio ↔ VERA Brain — CEREBRO ÚNICO, single-tenant Varela — 2026-06)
- Decisión: unificar el "pensar" de la app Studio con VERA Brain (modo studio) para Varela. Multi-inquilino / "Vera Studio V2 vendible" queda como futuro (P2, verde).
- Antes: la app Studio (`public/vera-studio.html`) pensaba en un Cloudflare Worker propio (`veraos.varelavendecde.workers.dev`) con prompt de copywriter incrustado + licencia/código → 2 cerebros distintos.
- Ahora: **ideas de carrusel** y **plan mensual** de Studio piensan con el MISMO cerebro que el chat (STUDIO_IDENTITY + cartera real + memoria + goals), entrenable en un solo lugar.
  - Backend `routes_studio.py`: `POST /api/studio/ideas` ({tema,enfoque,tono,n} → `{slides:[{titulo,sec,cta}]}`) y `POST /api/studio/plan` ({n,tono,foco} → `{items:[...]}`); ambos usan `_think()` → `_system("studio")` + `active_provider.reason` + parseo JSON robusto (`_parse_json`).
  - Frontend `vera-studio.html`: `generarIdeas`/`generarPlan` ahora hacen `fetch('/api/studio/ideas'|'/plan')` (mismo origen), se quitó el guard de código de acceso para esas dos funciones. Imagen/video SIGUEN en el Worker (requieren código) por ahora.
- Cómo se "entrena" el cerebro único: editar `vera_brain/studio.py` (STUDIO_IDENTITY) impacta chat + tool; la memoria/knowledge de VERA es compartida.
- Verificado E2E: curl ideas (4 placas, palabras *marcadas*, \n, CTA final, tono picante) + curl plan (mix carrusel/ugc/propiedad/personal/vendida, tonos rotados, datos reales de zona) + screenshot del tool generando sin código de acceso, placa renderizada OK, sin errores de consola.
- Nota: el plan con n grande puede tardar (~45s+). Imagen/video quedan atados al Worker.

## Implemented (Studio — Panel de entrenamiento + Ideas por propiedad — 2026-06)
- **Panel de entrenamiento (cerebro único, editable sin código)**: en el chat de "Hoy", modo Studio, botón **"Entrenar"** abre un modal para escribir la persona/estilo de VERA Studio. Se guarda en Mongo (`studio_config/studio_training`) y se inyecta en `_system("studio")` con prioridad alta → afecta chat Y herramienta Studio a la vez.
  - Backend: `vera_brain/training.py` (get/set), `GET|PUT /api/studio/training`. Frontend: `veraStudioBrain` en brain-gateway + modal `.vera-train` en `VeraChat.tsx`.
- **Ideas por propiedad**: en la herramienta Studio (`vera-studio.html`, tab Carrusel) nuevo desplegable **"Propiedad de tu cartera"** que se puebla desde `GET /api/studio/properties` (29-30 activas). Al elegir una y generar, VERA arma el carrusel con sus **datos reales** (precio, ambientes, zona, amenities) sin escribir tema.
  - Backend: `GET /api/studio/properties` (id+label), `IdeasBody.property_id` opcional + `_property_context()` (fetch vía `property_repository.get`) inyectado al prompt. tema opcional si hay propiedad.
- Verificado E2E: curl (training PUT/GET, properties list=29, ideas por propiedad usando datos reales: "350 m², carpinterías Aluar, 660 m² forestados, USD 590.000") + screenshots (tool: PH generó "UN PH EN EL BOSQUE, A 500 METROS DEL MAR" sin tema; chat: modal Entrenar carga/guarda). tsc limpio. Entrenamiento reseteado a vacío para el usuario.

## Implemented (VERA Chat — Modo ampliado — 2026-06)
- Botón **"Ampliar"/"Reducir"** (Maximize2/Minimize2) en el header del chat de "Hoy". Abre el chat como overlay casi a pantalla completa (`.vera-chat--expanded`: fixed, top 88px/bottom 24px, ancho min(1080px, 100vw-48px)) con backdrop oscuro (`.vera-chat__backdrop`). Cierra por botón, click en fondo o tecla Escape.
- Aplica a ambos modos (VERA y Studio). `VeraChat.tsx`: estado `expanded` + useEffect Escape; CSS en index.css.
- Verificado por screenshot: chat expandido 1080×1032, header completo visible, sin superponerse a la barra superior. tsc limpio.
- FIX (2026-06): el overlay quedaba confinado al área de contenido (un ancestro con `transform` rompía `position:fixed`, se veía la sidebar por detrás). Solución: el chat ampliado se renderiza en un **portal a `document.body`** (`createPortal`) + z-index 1000/1001. Backdrop cubre 1920×1080 completo. Verificado por screenshot.

## Implemented (VERA Chat — Formato enriquecido de respuestas — 2026-06)
- Nuevo `VeraMessage.tsx`: parser propio (sin dependencias) que renderiza la salida de VERA con títulos (#), viñetas (- •), listas numeradas (1.), líneas ★, **negritas** y *palabras destacadas* (dorado, clase `.vera-md__hl`).
- `VeraChat.tsx`: `clean()` ya NO borra el markdown (solo saca `---`); los mensajes de VERA se renderizan con `<VeraMessage/>`, los del usuario siguen en `<p>` plano. Bubble movido de `p` a `.vera-md`. CSS `.vera-md*` en index.css.
- Verificado por screenshot en chat ampliado con respuesta real de Studio: 5 h4, 15 listas, 42 <strong>, 20 highlights; se lee claro y estructurado. tsc limpio.

## Bug Fix (VERA Brain — "No pude responder" en respuestas largas — 2026-06)
- CAUSA RAÍZ: el proxy/ingress corta la petición a los ~60s. `/api/brain/ask` (no-stream) devolvía 502 (página HTML de Cloudflare) cuando la generación de Studio superaba 60s → el front mostraba "No pude responder en este momento". Reproducido: pedido pesado = 60.3s → HTTP 502.
- FIX: **streaming SSE**. Nuevo `POST /api/brain/ask/stream` (`StreamingResponse` text/event-stream) que emite `data: {"delta": ...}` token a token y `{"done": true}` al final; guarda la conversación al terminar. Provider: `ClaudeProvider.stream()` usa `LlmChat.stream_message()` (TextDelta). `brain.ask_stream()`.
- Frontend: `veraBrain.askStream()` (lee ReadableStream/SSE) y `VeraChat.send()` ahora muestra a VERA **escribiendo en vivo** (append incremental + formato renderizado en tiempo real). El indicador de "pensando" se apaga al primer token.
- Steer de concisión en `STUDIO_IDENTITY`: por defecto breve; no vuelca el guion toma-por-toma de TODAS las ideas de una (ofrece desarrollar UNA), para que las respuestas terminen con margen dentro de los 60s.
- Verificado E2E: curl stream (pedido normal 6483 chars, `done:true`, 51s; pedido gigante ahora entrega parcial en vivo con HTTP 200 en vez de 502) + screenshot (VERA escribiendo en vivo con formato en el chat ampliado, modo Studio). tsc + imports backend OK.
- NOTA: `/api/studio/ideas` y `/api/studio/plan` (herramienta) siguen sin stream (devuelven JSON); el plan con muchos días podría acercarse a 60s — pendiente stream/chunk si hace falta. El `ask` no-stream queda como fallback sin uso en el front.
- Producción: requiere REDEPLOY para aplicar el fix en real-estate-os-10.emergent.host.

## Implemented (VERA Chat — Botón Detener + streaming abort — 2026-06)
- Mientras VERA responde (streaming) el botón de enviar se convierte en **Detener** (icono Square, pulso). Al tocarlo aborta el fetch (`AbortController`) y **conserva el texto parcial** ya recibido; vuelve el botón Enviar.
- `veraBrain.askStream()` acepta `AbortSignal`; ante `AbortError` devuelve el texto parcial sin lanzar. `VeraChat`: estado `streaming` + `abortRef`. CSS `.vera-chat__send--stop`.
- Verificado por screenshot: aparece Detener al escribir, corta a mitad, parcial preservado (268 chars), Enviar de vuelta. tsc limpio.

## Implemented (VERA — Visión / análisis de imágenes — 2026-06)
- VERA ahora ANALIZA imágenes (Claude Sonnet visión vía emergentintegrations `UserMessage.file_contents=[ImageContent(image_base64)]`). Análisis adaptativo al contexto (leer un screenshot para responder a un cliente, analizar una propiedad/aviso, resumir, etc.).
- Backend: `ClaudeProvider.reason/stream` + `brain.ask/ask_stream` aceptan `images`; `_user_message()` arma multimodal (strip de prefijo data-url). `AskRequest.images` en `/api/brain/ask` y `/ask/stream`. `IdeasBody.images` + `_think(prompt, images)` en `/api/studio/ideas` (permite ideas solo-imagen).
- Frontend CHAT (`VeraChat.tsx`): botón clip (Paperclip) + input file (image/*, multiple, hasta 4), redimensión client-side a máx 1280px JPEG 0.82 (`resizeToBase64`), tira de miniaturas con quitar, la imagen se muestra en el mensaje del usuario. `veraBrain.askStream` envía `images` (base64). Funciona en modo VERA y Studio, con streaming + Detener.
- Herramienta Studio (`vera-studio.html`, tab Carrusel): input "Imagen de referencia" (multiple, resize client-side), preview con quitar, envía `images` en el fetch a `/api/studio/ideas`; permite generar solo desde imagen.
- Verificado E2E: chat+img (stream, analizó foto real y rectángulo de test correctamente), studio+img (4 placas desde imagen), UI chat (clip→miniatura→imagen en mensaje→análisis) y UI studio (input+preview, sin errores de consola). tsc limpio, backend imports OK.
- Payloads livianos por resize client-side (evita el límite de body / 60s). Producción: requiere REDEPLOY.

## Bug Fixes (Placa desbordada + descarga sin extensión — 2026-06)
- PLACA UGC desbordada con mucho texto: `renderUgc()` en `vera-studio.html` anclaba el bloque título+secundario+CTA con posición fija y se cortaba abajo. FIX: se calcula el alto total y se ESCALA el bloque (fuentes/altos/gaps, factor min 0.5) para que SIEMPRE entre entre el logo (topLimit) y el pie (botLimit = H - lineOff - 120); anclaje arriba/centro/abajo recalculado. Verificado por screenshot con texto largo (título 7 líneas + sec 3 líneas + CTA, todo visible). Sirve para Feed 4:5 e Historia 9:16.
- DESCARGA INDIVIDUAL sin extensión (bajaba "foto-4" sin .jpg, no abría; el .zip sí andaba): en `routes_files.py` el filename salía de `original_name/stored_name` que a veces no tenía extensión. FIX: `_ensure_ext(filename, mime)` agrega extensión según mime_type (image/jpeg→.jpg, png, webp, heic, etc.) antes del Content-Disposition en `/properties/{id}/images/{id}/download`. Verificado (unit + endpoint real).
- Producción: requiere REDEPLOY.

## OG Cover + Studio memoria/interrogatorio (2026-06)
- OG COVER: regenerada `/app/frontend/public/og-cover.jpg` (1200x630) con el LOGO ORIGINAL de Varela (escudo/óvalo) en amarillo de marca (#F6E63A) sobre foto costera al atardecer, tagline "COSTA DEL ESTE · MAR DEL TUYÚ" y URL con sombra. Script reutilizable en `/app/backend/make_og_cover.py` (colorea `assets/brand/varela-logo.png` vía canal alpha). El usuario debe subirla manualmente a su repo de GitHub externo + "Scrape Again" en FB Debugger.
- STUDIO "sin memoria": la memoria multi-turno FUNCIONA (confirmado por curl: recordó nombre y "quién en cámara"). El problema era de DISEÑO del persona: `STUDIO_IDENTITY` (studio.py) forzaba 3-5 preguntas por turno y RE-preguntaba lo ya respondido. FIX: bloque "MEMORIA Y CONTEXTO" (prohíbe repreguntar lo ya contestado) + PASO 1 reescrito (máx 2-3 preguntas UNA sola vez; ante duda ENTREGAR; nunca dos rondas seguidas). Verificado por curl: T1 = 1 pregunta, T2 = entrega ideas directo. Solo cambio de prompt backend (hot-reload); no requiere tocar frontend.
- Producción: ambos requieren REDEPLOY (y la OG, además, subida manual al repo externo).

## Cartel viral IA — nuevo modo en VERA Studio (2026-06)
- Nuevo modo "Cartel viral IA ✨" en `vera-studio.html` para generar imágenes llamativas (cartel gigante) con MARCA 100% exacta. Estrategia 2b elegida por el usuario: la IA genera la ESCENA con un cartel EN BLANCO en colores de marca (amarillo #F6E63A + negro) y el tool superpone el LOGO real + texto nítido (LOTE / ubicación / precio) por canvas.
- 6 recetas de un clic: persona sosteniendo cartel gigante, valla plantada en el lote, cartel flotando (escala imposible), valla de ruta, cartel emergiendo del pinar, mano gigante. Formatos 16:9 / 9:16 / 1:1.
- Motor: reutiliza el Worker externo (`veraos.varelavendecde.workers.dev/editar`, gpt-image-2) con prompt que fuerza cartel BLANCO front-facing en colores de marca, sin texto/logo. Overlay de marca ARRASTRABLE (pointer events) + sliders de tamaño e inclinación; logo real (logoImg) + Oswald con autofit. Copy manual o autocompletado desde propiedad real.
- Backend: `/api/studio/properties` ahora devuelve también precio/ubicacion/tipo/operacion (para el autocompletado del cartel). Backward compatible.
- Verificado: modo carga sin errores de consola, 6 recetas OK, canvas renderiza el overlay nítido (screenshot), `/api/studio/properties` HTTP 200. La generación IA real depende del código de acceso del usuario (mismo flujo /editar ya probado en Potencial/Diseño) — no testeado e2e con IA por requerir su código.
- Producción: requiere REDEPLOY. El usuario puede descargar la última versión del HTML desde /vera-studio.html.
