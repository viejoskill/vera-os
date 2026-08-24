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

## Cartel viral IA — iteración full-IA + realismo (2026-06)
- El usuario descartó la estrategia 2b (overlay canvas: quedaba rígido/pegado). Cambiado a FULL-IA: la IA dibuja el cartel completo (texto+precio+logo) integrado a la escena. Se pasa el LOGO real como SEGUNDA imagen `image[]` al Worker /editar (gpt-image-2, quality=high).
- Feedback "falta realismo y frescura" → prompt reescrito con dirección fotográfica avanzada: material físico real por receta (lona/vinilo, postes, estructura metálica), micro-imperfecciones (arrugas, ojales, polvo), misma luz/sombra/temperatura de la escena, tinte del entorno en bordes, anti "vector/sticker/render". Nuevo selector "Look/acabado": Foto natural (celular/UGC), Editorial premium, Hora dorada cinematográfica (LOOKS_CARTEL). caPrompt arma ~2600 chars.
- Verificado: modo carga sin errores, caLook 3 opciones, caPrompt OK. La calidad real depende de gpt-image-2 (no testeable e2e sin el código de acceso del usuario). RIESGO: el logo va como 2da imagen; si el Worker solo reenvía la 1ra, el logo se interpreta del texto.
- Producción: requiere REDEPLOY; herramienta suelta: descargar /vera-studio.html.

## Cartel viral IA — logo fuera del cartel + datos chicos (2026-06)
- El usuario aprobó el realismo. Correcciones: (1) el logo YA NO lo dibuja la IA en el cartel; (2) el LOGO real se superpone como marca de agua en la placa, esquina arriba-izq o arriba-der (select caLogoPos), con chip translúcido para legibilidad (caLogoOverlay en canvas); (3) donde iba el logo, el cartel ahora muestra DIRECCIÓN Y MEDIDAS en chico (campo caDatos, va al prompt); (4) texto principal editable (default LOTE).
- Backend: `/api/studio/properties` ahora devuelve también `direccion` (address) y `medidas` (lot_area_m2/area_m2 → "N m²") para autocompletar caDatos. Backward compatible.
- caGen ya NO envía el logo como 2da imagen (evita el riesgo del Worker). Prompt actualizado: "no agregues ningun logo/marca en el cartel".
- Verificado: overlay del logo en esquina OK (screenshot), prompt incluye datos + instrucción sin-logo (len ~2567), sin errores de consola, routes_studio.py OK. Calidad IA real depende de gpt-image-2 (no e2e sin código de acceso).
- Producción: requiere REDEPLOY; herramienta suelta: descargar /vera-studio.html.

## Cartel viral IA — ajustes de marca (2026-06)
- Logo overlay: sin chip de fondo y más chico (13% ancho) con sombra sutil, coherente con otras placas del Studio (caLogoOverlay).
- Colores del cartel en el prompt: amarillo DORADO cálido de marca (~#F5C518, no limón/verdoso) + gris oscuro carbón (~#262626, no negro puro).
- Nuevo campo "Precio anterior" (caPrecioAntes): cuando hay rebaja, el prompt pide el precio anterior TACHADO en gris claro + el nuevo destacado.
- Verificado: prompt incluye #F5C518, #262626, tachado y precio anterior; logo overlay sin chip; sin errores de consola.
- Producción: requiere REDEPLOY; herramienta suelta: descargar /vera-studio.html.

## Amarillo VERA OS + logo oficial limpio (2026-06)
- Amarillo de marca unificado a #F6E63A (color primary de VERA OS, según design_guidelines.json). Reemplazado ORO, --oro, tint de recortarYUsar (246,230,58), glows y prompt del cartel en vera-studio.html.
- Logo: el procesado recortarYUsar recoloreaba TODO a un amarillo → las letras blancas "VARELA" se perdían (ese era el "error"). Solución: logo oficial vectorial limpio (transparente) guardado en /app/frontend/public/varela-logo-brand.png (recortado del artifact "Logo Varela Vec"), y función cargarLogoOficial() que lo usa TAL CUAL (sin recolorear). Se carga por defecto si no hay logo guardado + botón "Usar logo oficial Varela" en Identidad para restaurarlo en 1 clic.
- Verificado: logo oficial carga por defecto, overlay del cartel limpio (óvalo amarillo + VARELA blanco), sin errores de consola.
- Producción: requiere REDEPLOY; herramienta suelta: descargar /vera-studio.html (y el asset varela-logo-brand.png va incluido al servir desde /public).

## Fix logo con fondo blanco (2026-06)
- El logo "Logo Varela Vec.png" que se estaba usando tenía un FONDO BLANCO semi-opaco horneado (alpha ~92 en toda la caja) → al aplicarlo salía con caja blanca. 
- Fix: reconstruí /app/frontend/public/varela-logo-brand.png desde backend/assets/brand/varela-logo.png (negro sobre transparente, alpha limpio), recoloreado a #F6E63A y upscaled x2 (1184x548). Transparencia real verificada (48% px alpha 0, compositado sobre oscuro sin caja blanca).
- El botón "Usar logo oficial Varela" y el default ahora cargan este PNG limpio. NOTA: es logo mono-tono amarillo (letras VARELA en amarillo, no blancas) por limitación del source; si se quiere versión bicolor (letras blancas) hace falta un vector bicolor limpio.
- Verificado en herramienta: overlay del cartel sin caja blanca, sin errores de consola.

## Módulo "Infografía IA" en VERA Studio (2026-06)
- Nuevo modo "Infografía IA 📊" en vera-studio.html. VERA Brain arma el CONTENIDO estructurado (JSON) y se renderiza en canvas con identidad Varela (fondo #0B0B0C + amarillo #F6E63A + logo).
- 4 formatos: piramide, pasos/checklist, comparacion (A vs B), dato+barras, + "auto" (VERA elige). Formato 4:5 (1080x1350) y 9:16 (1080x1920).
- Arranca desde TEMA o desde una PLACA DE REFERENCIA subida (visión): VERA la REINTERPRETA (no copia). Textos generados por VERA + totalmente editables (título, subtítulo, contenido multilínea "campo | campo", columnas A/B, pie).
- Backend: nuevo endpoint POST /api/studio/infografia (routes_studio.py) usa _think (brain + visión) + _parse_json. No requiere el Código de acceso VERA (usa Emergent LLM key del backend); sí requiere ai_configured.
- Verificado: backend HTTP 200 con JSON válido; los 4 renderizadores dibujan OK (piramide con textos envueltos sin cortes, dato con nº gigante + barras, pasos con círculos numerados, comparacion 2 columnas); generación real end-to-end desde el botón OK; sin errores de consola.
- Producción: requiere REDEPLOY; herramienta suelta: descargar /vera-studio.html.

## Carrusel: usar fotos de referencia en las placas (2026-06)
- Antes: las fotos de referencia solo se mandaban a VERA para leer contexto (copy); NO se colocaban en las placas. 
- Ahora: VERA decide por placa (endpoint /api/studio/ideas devuelve foto:bool + estilo:"ugc"|"img"|"flat" por slide cuando hay imágenes). El frontend asigna las fotos subidas como fondo cicleando: ugc=foto full + chips, img=foto + degradé editorial, flat=texto. La placa de contacto (última) queda como texto.
- UI: toggle "Usar mis fotos como fondo de las placas" (ON al subir fotos) + botón "Aplicar mis fotos" (reasigna sin regenerar). studioImgs ahora guarda .el (Image) para dibujar. aplicarFotos()/quitarFotos() en vera-studio.html.
- Verificado: backend HTTP 200 devolviendo mezcla inteligente (ugc/flat/img/ugc); render de placa con foto de fondo OK (screenshot); sin errores de consola.
- Producción: requiere REDEPLOY; herramienta suelta: /vera-studio.html.

## Fix dorado en títulos multilínea (2026-06)
- Bug: en títulos, el resaltado dorado (*...*) no se activaba cuando el par de asteriscos cruzaba un salto de línea (\n), porque el título se dividía por \n y cada línea se parseaba por separado con parseSpans (regex exige ambos * en la misma línea). En el secundario (1 línea) funcionaba.
- Fix: nueva función parseSpansML(text) que arrastra el estado dorado a través de los \n y devuelve líneas de spans. Reemplazado en renderUgc (chips), renderCont (título) y el renderer de historia/portada (línea ~2217) en vera-studio.html.
- Verificado: título "O comprás *tres fuentes\nde ingresos*" ahora dorado en ambas líneas (screenshot); sin errores de consola.

## Caption IG/TikTok en Carrusel, Post y Cartel (2026-06)
- Nueva ventana (modal compartido #capModal) que genera el TEXTO para publicar en Instagram y TikTok con muchos emojis + hashtags, para resolver la publicación en el mismo lugar.
- Backend: POST /api/studio/caption (routes_studio.py) → VERA Brain devuelve {ig, tiktok, hashtags}. IG con gancho+valor+CTA (DM/WhatsApp), TikTok más corto/informal, 12-18 hashtags locales. No inventa datos.
- Frontend: botón "📱 Texto para publicar (IG/TikTok)" en Carrusel (capBtnCont), Post (capBtnProp) y Cartel viral (capBtnCartel). El contexto se arma por modo (tema+placas+propiedad / campos del post / datos del cartel). Modal con textareas editables, copiar individual, "Copiar TODO (IG+hashtags)", "Generar otra versión". No requiere Código de acceso VERA (usa Emergent key backend).
- Verificado: endpoint HTTP 200 con caption real (emojis+CTA+hashtags); modal abre, genera y copia OK (screenshot); sin errores de consola.
- Producción: requiere REDEPLOY; herramienta suelta: /vera-studio.html.

## Implemented (Vera Studio — "Portada gancho IA" — 2026-06)
Nuevo modo dentro del módulo **Portadas** de Vera Studio (`vera-studio.html`): genera pósters/portadas gancho estilo viral (9:16 Historia y 4:5 Feed) manteniendo la estética de marca. Verificado E2E (curl `/api/studio/portada` + screenshots Feed/Historia).
- **UI**: sub-pestañas "Clásica" / "Gancho IA" en el panel Portadas (no rompe la portada clásica existente). El modo Gancho: subir foto (vos o la propiedad) + brief libre + botón "Generar portada con VERA".
- **Backend** (`routes_studio.py` `POST /studio/portada`, ya existía): a partir del brief (+foto opcional) devuelve JSON estructurado `{tag_izq, tag_der, titulo (con *palabras* en dorado y \n), bajada, marca, datos[{icono,texto}], episodio}`. Cada generación varía el copy manteniendo la marca. No inventa datos.
- **Editable**: todos los textos que propone VERA quedan en inputs editables (tags, titular, bajada, marca, episodio) + editor de datos (ícono/texto, agregar/quitar hasta 6) + toggle "Mostrar datos". VERA propone, el usuario decide.
- **Render canvas** (`renderPortadaGancho`): foto full-bleed con scrims para legibilidad, tags con borde dorado en esquinas superiores, titular grande Oswald con palabras clave en amarillo `#F6E63A`, bajada, fila de píldoras de datos con ícono, barra inferior con logo Varela + marca/lema + pastilla de episodio dorada. Layout responsivo a Feed (1080×1350) y Historia (1080×1920). Descarga con el botón de siempre (`dl1`).
- Archivos: `/app/frontend/public/vera-studio.html` (panel + JS + render), `/app/backend/routes_studio.py` (endpoint, preexistente).

## Implemented (Tasación — rediseño del reporte JPG — 2026-06)
Se reemplazó por completo el diseño del reporte de tasación que genera `POST /api/tasacion/jpg` (`routes_tasacion.py`, render PIL 1080×1620). Verificado con inspección de imagen (casa completa + lote). El flujo del frontend (Tasador manual → "Generar JPG" → descarga/WhatsApp) no cambió.
- Header: **logo Varela** arriba-izq + "REPORTE DE TASACIÓN" / ID REPORTE (VR-AAAA-MMDD-XXXX) / FECHA (con ícono calendario) a la derecha; divisor dorado.
- PROPIEDAD: label + subrayado dorado + dirección grande (auto-fit) + **SOLICITANTE** (nombre · teléfono del propietario, debajo de la dirección — pedido del usuario) + pin "Costa del Este · Mar del Tuyú" + badge de tipo.
- Caja protagonista: **"VALOR DE CIERRE REAL ESTIMADO"** (antes "VALOR RECOMENDADO VERA") con rango `cierreMin–cierreMax` + subtítulo.
- Dos tarjetas: "REFERENCIA DE MERCADO" (rango de portales `pubMin–pubMax`, ícono barras) y "CONFIANZA IA" (**valor fijo 94% + pill verde ALTA**, ícono escudo).
- Fila de specs con íconos line-art dibujados en PIL (home/warehouse/terreno/cama/baño), adapta según tipo (casa/depto/lote).
- Nota explicativa con ícono sparkle. Pie: "POWERED BY Varela Propiedades / **Sebastián Varela · Asesor Inmobiliario · hace 20 años en Costa del Este**" (firma fija) + co-branding "VERA OS · Real Estate Intelligence" a la derecha. **Sin QR** (decisión del usuario).
- Modelo `JpgBody` ahora acepta `telefono` y `email` (el frontend ya los enviaba).
- Assets: usa `backend/assets/brand/varela-logo.png`.

## Implemented (Alquileres Temporarios — Fase 1 — 2026-08)
Módulo nuevo de rentas de verano estilo Airbnb. Verificado E2E por testing_agent: backend 19/19 pytest, frontend 100%, cero issues.
- **Backend** (`routes_rentals.py`, prefijo `/api/rentals`, MongoDB colecciones `rental_properties` + `rental_reservations`, ids uuid string):
  - CRUD propiedades; fotos a Supabase storage (`rentals/{pid}/images/...`) servidas por proxy público `/public/image/{imgId}` (content-type persistido).
  - Disponibilidad por overlap estricto (fechas contiguas permitidas); cotización `_quote` con descuentos por tramo: 7+ semana, 15+ quincena, 30+ mes (mejor tramo aplicable).
  - Reservas/pre-reservas + bloqueos manuales (estado 'bloqueo'); overlap → 409; cancelar libera fechas.
  - Público: listado activas, detalle por slug (+ocupados +descuentos), quote, prereserva (nombre/tel/email/DNI/huéspedes/comentario + origen).
- **Frontend interno** (`screens/rentals/`): `/alquileres` (tabs Propiedades|Reservas, confirmar/rechazar, link ML con origen), `/alquileres/nueva` y `/:id` (RentalWorkspace: datos, precio+descuentos, fotos, calendario+bloqueos, reservas). Calendario reutilizable `RentalCalendar` (selector de rango, marca ocupados). Nav item "Alquileres" (Palmtree) + feature flag `alquileres`.
- **Frontend público**: `/reservar` (listado, tema claro Airbnb, logo Varela) y `/reservar/:slug` (galería, specs, amenities, calendario 2 meses, cotización con descuento, form huésped → pre-reserva → pantalla de éxito). Pre-reserva SIEMPRE queda pendiente de confirmación interna.
- **Funnel ML**: link/QR por propiedad con `?origen=ml` → marca origen 'MercadoLibre' en la reserva (no hay API de import de ML; queda para fase avanzada vía OAuth).
- **Decisiones del usuario**: propiedades set aparte; solo verano (sin temporadas); precio/noche + descuentos semana/quincena/mes; roles de empleados = fase siguiente (hoy lo usa el admin logueado).
- **Pendiente/backlog**: login de 2 empleados con acceso restringido (solo Alquileres, sin liquidaciones/config); hardening (unique index anti doble-booking concurrente, rate-limit del endpoint público de pre-reserva).

## Alquileres — Propietario + Importar de Ventas (2026-08)
- **Datos del propietario** por propiedad de alquiler: `propietario {nombre, telefono, email, dni, observaciones}` en `PropertyBody`, sección "Propietario" en el RentalWorkspace. Se guarda/lee en Mongo, no se expone en la web pública.
- **Importar del CRM de ventas**: `GET /api/rentals/sale-properties` (lista propiedades de venta desde Supabase, covers con signed URL en paralelo ~3s) + `POST /api/rentals/import/{sale_id}` (crea alquiler prellenado: título/dirección/localidad/dormitorios/baños/descripción, capacidad estimada = dorm×2, **copia las fotos** al path de rentals para que sean independientes de la publicación de venta, queda `activa=false` hasta ponerle precio). UI: botón "Importar de ventas" + modal con buscador en AlquileresScreen. Verificado por curl (30 props, import con 4 fotos copiadas, proxy 200).

## Alquileres — Huésped→Personas, borrar bloqueos, subdominio público (2026-08)
- **Huésped→Personas**: al confirmar una reserva (PATCH estado='confirmada'), `routes_rentals.update_status` llama a `person_resolver.resolve` con role='inquilino' (full_name, phone, whatsapp, email, document=DNI). Verificado (aparece en /api/people?role=inquilino). Persona de prueba borrada del Supabase compartido.
- **Borrar/corregir bloqueos**: RentalWorkspace lista "Fechas bloqueadas" (estado 'bloqueo') con botón Quitar → `api.deleteReservation` (DELETE /rentals/reservations/{id}). Verificado en UI.
- **Subdominio de marca**: VeraOS.tsx detecta `hostname.startsWith('alquileres.')` y sirve SOLO la web pública de reservas (`/` → ReservarPublico, `/reservar/:slug` → ReservarPropiedad), sin AuthProvider/login/OS. Objetivo: alquileres.varelapropiedadescde.com.ar. Requiere que el usuario (1) confirme con soporte Emergent si se puede vincular un 2º dominio custom al mismo deploy, (2) cree el CNAME en Cloudflare (DNS only), (3) agregue el botón en su web de ventas (repo GitHub propio). Botón interno "Ver web" agregado en AlquileresScreen.
- www.varelapropiedadescde.com.ar es un sitio ESTÁTICO separado (repo GitHub del usuario, hecho con Claude); VERA solo le escribe la cartera de ventas vía web_publisher. El botón hacia alquileres lo agrega el usuario en ese repo.

## Alquileres — Web pública rediseñada al branding Varela (2026-08)
Las páginas públicas (/reservar y /reservar/:slug) se rediseñaron para ser idénticas a varelapropiedadescde.com.ar: tema oscuro `#1E1E20`, dorado `#D6CC6A`, fuentes DM Sans (body) + Playfair Display (títulos/serif), tarjetas `#272729`, CTA amarillo. Se cargan las Google Fonts vía @import en rentals.css y el tema público se aplica con un bloque de override al final del archivo (scopeado bajo .rt-pub, no afecta el tema interno VERA). Verificado por screenshot (listado + detalle).
## Alquileres — Dominio (resuelto)
Emergent permite 1 solo dominio custom por deployment. Decisión del usuario: por ahora queda en veraosvarela.com/reservar; el subdominio de marca alquileres.varelapropiedadescde.com.ar se resolvió con redirect 301 (Cloudflare Page Rule → veraosvarela.com/reservar). El subdominio nativo requeriría un 2º deployment (créditos aparte) — descartado por ahora.

## Alquileres — 4 features (2026-08)
1. **Código CDE###**: contador autoincremental (`rental_counters`, ReturnDocument.AFTER) + backfill lazy en listados (más antigua = CDE001). Visible en tarjeta interna, header del workspace y detalle público. `codigo` en _prop_out.
2. **Aviso de pre-reserva**: `public_prereserva` llama a `notifications.create(type='rental_prereserva', link='/alquileres')` → aparece en el NotificationBell del OS. Badge de pendientes en la pestaña "Reservas".
3. **Empleados (acceso restringido)**: reutiliza el sistema existente `app_access` (approved + isAdmin). AppLayout: empleado = aprobado NO admin → nav muestra SOLO "Alquileres" y redirige a /alquileres desde cualquier otra ruta. Admin (varelavendecde@gmail.com) ve todo. Los 2 empleados se agregan por el flujo de /equipo (ingresan con su cuenta y el admin los aprueba SIN marcar admin). Verificado con qa_varela (no admin) → solo ve Alquileres. Import de person_resolver movido a local (evita import circular).
4. **Búsqueda por código**: buscador en pestaña Propiedades (filtra por código/título/dirección). Código también en tarjetas de la web pública.

## Implemented (Alquileres · Fase 3 — Ficha Financiera & Liquidaciones — 2026-06)
Seguimiento financiero por propiedad + liquidaciones al propietario por período. Verificado: backend por curl (cálculos + filtro de fechas) y frontend 100% por testing agent (iteration_43.json).
- **Ficha financiera** (en RentalWorkspace, sección propia): alta/baja de movimientos tipados — `ingreso` (seña/cobro), `gasto_prop` (a cargo del propietario), `gasto_nuestro` (a cargo de la agencia), `comision`. Endpoints: `GET /api/rentals/properties/{pid}/movimientos`, `POST /api/rentals/movimientos`, `DELETE /api/rentals/movimientos/{mid}`. Colección Mongo `rental_movimientos`.
- **Comisión automática**: al confirmar una reserva (`PATCH /reservations/{rid}` estado=confirmada) se genera un movimiento `comision` = max(monto × comisionPct%, comisionMinima) — idempotente por `reservaId`, editable/borrable luego.
- **Liquidaciones** (`LiquidacionesScreen.tsx`, ruta `/liquidaciones`, SOLO admin): elegir propiedad + rango de fechas → `GET /api/rentals/liquidacion?propertyId=&desde=&hasta=`. Muestra Alquileres cobrados, − Comisión, − Gastos del propietario y **Neto a liquidar = Ingresos − Comisión − Gastos del propietario** (los gastos de la agencia NO se descuentan, se muestran aparte). Lista los movimientos del período.
- Verificado E2E: CDE002 de prueba → ingresos 315.000, comisión 31.500, gasto_prop 20.000, gasto_nuestro 8.000 → neto **263.500** correcto; filtro por fechas excluye movimientos fuera del rango.
- Nit cosmético no bloqueante: inputs `type=date` muestran mm/dd/yyyy según locale del navegador de test (en el navegador argentino del usuario se ve dd/mm/yyyy; `<html lang="es">` ya está seteado).
- Propiedad de prueba CDE002 (`6744cf8a907f4a239a7504101c66a2df`) queda cargada en el preview; el usuario la borrará.


## Implemented (Alquileres · Link de pago (Mercado Pago) + Recibo PDF — 2026-06)
Dos features sobre la Fase 3. Verificado: backend por curl (link real + PDF 200) y frontend 100% por testing agent (iteration_44.json).
- **Link de pago de la seña (Mercado Pago Checkout Pro)**: en una reserva confirmada/pre-reserva, el admin genera un link de pago en **pesos ARS**. El monto lo escribe el admin (sugerido **30% del total** precargado para reservas en ARS; para reservas en USD ingresa el equivalente en ARS a mano). Al generar, el link se copia al portapapeles y la reserva muestra el estado de la seña (`link enviado` / `rechazada` / `Seña pagada`). Componente `CobrarSena.tsx` (botón + modal) reutilizado en `AlquileresScreen` (pestaña Reservas) y `RentalWorkspace`.
  - Backend: `payments_mp.py` (único módulo que toca el SDK `mercadopago==3.3.0`), `POST /api/rentals/reservations/{rid}/payment-link` (crea preference, guarda `pago{proveedor,monto,moneda,estado,preferenceId,initPoint}` en la reserva), `POST /api/rentals/payment-webhook` (verifica el pago server-side y marca `pagado`/`rechazado`), `GET /api/rentals/reservations/{rid}`. Config `MP_ACCESS_TOKEN` (producción, solo backend), `MP_WEBHOOK_SECRET` (vacío por ahora), `PUBLIC_APP_URL` en `.env`; `config.mp_configured()`.
  - Notas: token de PRODUCCIÓN (cobros reales). El webhook aún no valida firma HMAC (`MP_WEBHOOK_SECRET` vacío) — la verdad la da la consulta server-side del pago. Fuente de verdad = webhook + `payment.get`, nunca el redirect del navegador. Back URLs apuntan a `/pago/resultado` (placeholder, sin pantalla dedicada aún).
- **Recibo PDF de liquidación**: `rentals_pdf.py` (reportlab, reutiliza el logo Varela negro de `documents/pdf.py`). `GET /api/rentals/liquidacion/pdf?propertyId=&desde=&hasta=` → PDF con logo, código+título de la propiedad, propietario, período, tabla de movimientos, resumen con **Neto a liquidar destacado**, gastos de agencia informados aparte, fecha de emisión y firma de la inmobiliaria. Botón "Descargar PDF" (`rt-liq-pdf`) en `LiquidacionesScreen`.
- Dependencia nueva: `mercadopago==3.3.0` (en requirements.txt).


## Implemented (Alquileres · Proceso estricto + condiciones + calendario claro — 2026-06)
Set de mejoras pedidas por el usuario. Verificado: backend por curl y frontend 100% por testing agent (iteration_45.json, 9/9 PASS).
- **Calendario claro**: ocupado por reserva = ROJO rayado, bloqueo manual = GRIS rayado, con leyenda (`RentalCalendar` colorea por `estado`; props `readOnly`, `legend`, `startDate`). Aplica en workspace, vista previa y web pública.
- **Vista previa al confirmar** (`ConfirmarReserva.tsx`): al tocar "Confirmar" abre modal con resumen + calendario en modo lectura (fechas pedidas marcadas + reservas vecinas) + aviso de **"días perdidos"** (huecos de 1-2 noches). Al confirmar se autogenera la **seña (30% del total, solo ARS)** vía Mercado Pago.
- **Flujo estricto de pago**: estado mostrado con `displayEstado()` — confirmada sin pago pagado = **"Esperando seña"** (celeste), con pago pagado = **"Reservada · seña pagada"** (verde). Nuevo filtro/chip **"Esperando seña"** con contador en la pestaña Reservas. El webhook de MP marca `pago.estado=pagado` → pasa a Reservada.
- **Paso de condiciones antes de la pre-reserva pública**: modal con condiciones (generales + propias de la casa), datos clave (ropa blanca, mascotas, depósito, check-in/out, estadía mínima) y aviso de validez 24hs, con **tilde obligatorio** "Declaro haber leído y aceptado". Backend rechaza si `aceptaCondiciones` falso (400) y valida **estadía mínima** (400). Se guarda `condicionesAceptadas{aceptado,fecha}` en la reserva.
- **Condiciones por propiedad** (form en `RentalWorkspace`): ropaBlanca, aceptaMascotas, depositoGarantia, checkInHora, checkOutHora, estadiaMinima, condiciones[] (cláusulas libres). Persistidas en `PropertyBody`/`_prop_out` (públicas).
- **Condiciones generales** (fijas de la inmobiliaria): colección `rental_settings`, endpoints `GET/PUT /api/rentals/settings` (condicionesGenerales[] + avisoValidez). Editables desde el botón "Condiciones generales" en el header de Alquileres.
- Separadores de miles: `fmtMoney` ya usa `toLocaleString('es-AR')` — verificado en todos los lugares.
- Endpoints nuevos: `GET/PUT /api/rentals/settings`. Helper backend `_create_sena_link` reutilizado por link manual y autogeneración al confirmar.


## Implemented (Alquileres · WhatsApp asistido / click-to-send — 2026-06)
- Botón **"WhatsApp"** enriquecido en cada reserva (AlquileresScreen + RentalWorkspace) que abre `wa.me` con un mensaje **pre-escrito**: saludo al huésped, datos de la reserva (fechas, noches, total) y, si existe, el **link de seña de Mercado Pago**. Envío desde el WhatsApp propio del usuario (sin API, sin costo, sin plantillas Meta).
- Componente `WhatsappReserva.tsx`; utils `waLink()` y `mensajeReserva()` en `api.ts`. El mensaje se adapta al estado del pago (pendiente → incluye link; pagado → "reserva confirmada"; sin link → "en breve te enviamos los datos").
- DECISIÓN: el usuario NO tiene cuenta de WhatsApp Business/Twilio contratada. El envío 100% automático (server-side, sin intervención) queda como P1 pendiente y requiere contratar Twilio o Meta WhatsApp Cloud API (costo por mensaje + plantillas aprobadas). Mientras tanto, el aviso de nuevas pre-reservas ya llega por la campanita del OS.
- Verificado: tsc limpio + validación de la generación del link/mensaje. (Cambio chico self-contained, sin testing agent.)


## Implemented (Alquileres · Rechazo con WhatsApp + preview ámbar + separadores + eliminar — 2026-06)
Cuatro mejoras pedidas. Verificado: build de producción (CI=true) OK + testing agent (iteration_46.json, 4/4 PASS 100%).
- **Rechazo/cancelación con copy de WhatsApp** (`RechazarReserva.tsx`): al Rechazar/Cancelar abre un modal con motivo opcional y **vista previa del mensaje** al huésped; botones "Solo rechazar" y "Rechazar y avisar por WhatsApp" (abre wa.me con el texto). `mensajeRechazo()` en api.ts; `mensajeReserva()` ramifica a rechazo si estado=cancelada.
- **Vista previa al confirmar sin mezclar colores**: la pre-reserva en revisión se muestra en **ÁMBAR** (`.rt-cal--review`) y las reservas existentes en ROJO; se excluye la propia de `ocupados` (se pasa `otros`). Leyenda propia. Calendario arranca **1 mes antes** (`startDate`) y muestra **3 meses** para ver vecinas previas y siguientes. Modal `.rt-modal__box` ahora `overflow-y:auto` (max-height 88vh) → el botón "Confirmar y generar seña" siempre visible/accesible.
- **Separadores de miles en inputs de dinero** (`MoneyInput.tsx`, `toLocaleString('es-AR')`): aplicado a precio por noche, comisión mínima y depósito en garantía (formatea mientras se escribe, ej. 1.250.000; persiste el número).
- **Eliminar reservas** canceladas/finalizadas: botón papelera (`rt-delres` / `rt-wsdelres`) con confirm → `DELETE /api/rentals/reservations/{rid}` → sale de la lista. Mantiene la lista limpia.
- Componentes nuevos: `RechazarReserva.tsx`, `MoneyInput.tsx`. Prop `className` agregada a `RentalCalendar`.


## Implemented (Alquileres · Recibo de seña al huésped — 2026-06)
- **Recibo PDF de la seña** para enviarle al huésped. `build_recibo_sena_pdf()` en `rentals_pdf.py` (reportlab + logo Varela). Muestra: título "Recibo de seña", fecha de emisión, nombre + DNI del huésped, monto de la seña, propiedad (código+título), estadía, total de la reserva, **saldo pendiente** (solo si la reserva es en ARS = total − seña), medio de pago (Mercado Pago + id de operación), estado (PAGADA ✓ / PENDIENTE) y firma de la inmobiliaria.
- Endpoint `GET /api/rentals/reservations/{rid}/recibo-sena` (requiere que exista una seña con monto). Botón de descarga (ícono `FileDown`, testid `rt-recibo-<id>`) en `CobrarSena.tsx` que aparece cuando la seña está **pagada**.
- Verificado por curl + extracción de texto del PDF (Ana Huésped: seña $94.500, total $315.000, saldo $220.500, PAGADA ✓). Cambio self-contained, tsc limpio.
- Helper `_brand()` extraído en `rentals_pdf.py` para el encabezado de marca reutilizable.


## Implemented (Alquileres · Liquidación por reserva efectuada + formato de fecha dd/mm/yyyy — 2026-06)
Dos correcciones pedidas. Verificado: backend por curl + PDF, frontend 100% (iteration_47.json), build de producción OK.
- **Liquidación por reserva efectuada**: `LiquidacionesScreen` reescrita. Flujo: elegir propiedad → lista de **reservas con seña PAGADA** (`GET /properties/{pid}/liquidables`, filtra `pago.estado='pagado'`) → elegir una → detalle `GET /reservations/{rid}/liquidacion`: alquiler (montoEstimado) + ingresos extra − comisión − gastos del propietario = **neto**. El admin puede **agregar/eliminar** gastos/comisión (movimientos ligados a `reservaId`) y el neto recalcula. Descarga PDF `GET /reservations/{rid}/liquidacion/pdf` (con datos del huésped). "Reserva efectuada" = seña pagada; se ordenan por fecha de pago de la seña. Los gastos siguen siendo manuales por movimiento. Se mantiene el endpoint viejo de liquidación por rango de fechas (`/liquidacion`) pero la UI ahora es por reserva.
- **Formato de fecha dd/mm/yyyy** (día/mes/año) en TODO el texto renderizado: helper `fmtDate()` en api.ts (YYYY-MM-DD → DD/MM/YYYY). Aplicado en AlquileresScreen, RentalWorkspace (reservas + ficha financiera), LiquidacionesScreen, ConfirmarReserva (resumen + avisos), RechazarReserva (+ preview WhatsApp), ReservarPropiedad (éxito), mensajes de WhatsApp (`mensajeReserva`/`mensajeRechazo`) y PDFs (`rentals_pdf.py` helper `_fd()`). Los inputs `type=date` nativos quedan en formato del navegador (no controlable).
- Tipos nuevos: `LiquidacionReserva`. Métodos api: `liquidables`, `liquidacionReserva`, `liquidacionReservaPdfUrl`.


## Implemented (Alquileres · Pagos robustos + página de resultado + aviso WhatsApp del huésped — 2026-06)
Fix del bug "la seña no pasa de Esperando seña" (dependía solo del webhook) + feature de aviso al huésped. Verificado: backend curl + frontend 100% (iteration_48.json, 8/8).
- **Página pública de resultado del pago** `/pago/resultado` (`ReservaResultado.tsx`, ruta en ambos árboles de `VeraOS.tsx`): el huésped vuelve de Mercado Pago, se **verifica el pago server-side** (`GET /api/rentals/payment/verify?reservaId=&paymentId=`, no depende del webhook) y se marca la reserva pagada. Muestra "¡Pago recibido!" (o pendiente/rechazado) y un **botón WhatsApp** para que el huésped avise a la inmobiliaria ("ya aboné la seña… adjunto comprobante"). Número normalizado a `549`+local.
- **Panel (CobrarSena)**: botón **"Verificar pago"** (`POST /reservations/{rid}/verificar-pago` → busca el pago en MP por `external_reference` y actualiza) y **"Marcar pagada"** a mano (`POST /reservations/{rid}/marcar-pagada`, multipart: monto + metodo transferencia/efectivo/otro + **comprobante** opcional img/PDF guardado en Supabase, servido en `GET /reservations/{rid}/comprobante`). Lo puede hacer también el empleado. El chip de pagado muestra el método y el clip del comprobante.
- **Webhook mejorado** (`payment-webhook`): ahora lee body (v2) y query params (IPN), y usa `_apply_mp_payment()` compartido. Se mantiene como respaldo.
- **WhatsApp de la inmobiliaria** configurable en "Condiciones generales" (`settings.whatsappAgencia`, seteado a 2257404000). `payments_mp.search_approved_payment()` agregado.
- ⚠️ PRODUCCIÓN: para que MP redirija al huésped a `/pago/resultado` en veraosvarela.com, el entorno de producción debe tener `PUBLIC_APP_URL=https://veraosvarela.com`. Aunque falle el redirect/webhook, el admin/empleado destraba con "Verificar pago" o "Marcar pagada". Requiere redeploy.


## Implemented (Campanita fix + recordatorios de reservas próximas + recibo visible — 2026-06)
Verificado: backend curl + frontend 100% (iteration_49.json, 4/4).
- **Fix campanita**: el panel de notificaciones quedaba cortado porque `.vera-topbar` tiene `overflow:hidden` (para el halo). Se cambió `.vera-notif__panel` a `position: fixed` (arriba a la derecha, z-index 200) → ya no lo recorta el topbar. Media query para mobile.
- **Recordatorios de reservas próximas**: `documents/notifications.py` → `sync_rental_reminders()` crea un aviso `reserva_proxima` (idempotente por `documentId=reserva_proxima:<rid>`) para reservas confirmadas/en curso con **check-in dentro de las próximas 72hs** (mensaje "Check-in en X días (dd/mm/yyyy) · huésped · propiedad", link `/alquileres`). Se dispara on-demand en `GET /api/notifications` (la campanita hace polling cada 20s), sin cron. Ícono `CalendarClock` en la campanita para ese tipo.
- **Recibo PDF visible**: en `CobrarSena`, el recibo pasó de iconito a botón con texto **"Recibo PDF"** (rt-recibo). Aparece cuando la seña está pagada.


## Implemented (Alquileres · 4 avisos/recibo — 2026-06)
Verificado: backend curl (los 4 avisos se generan correctos) + tsc + build de producción OK. UI nueva sigue patrones ya testeados.
- **Segundo aviso (check-in del día)**: además del de 72hs, `sync_rental_reminders()` crea `reserva_hoy:<rid>` cuando el check-in es hoy ("Hoy ingresa {huésped} · {propiedad}").
- **Aviso de seña acreditada**: al marcar/verificar un pago como pagado (webhook, verify o marcar-pagada) se crea `sena_pagada:<rid>` en la campanita ("{huésped} pagó la seña de $X · {propiedad}"), una sola vez. `notify_sena_pagada()` en notifications.py, llamado desde `_apply_mp_payment` y `marcar_pagada`.
- **Recordatorio de saldo pendiente**: para reservas con seña pagada, saldo > 0 y check-in dentro de 5 días → `saldo_pendiente:<rid>` ("Cobrar saldo de {huésped}: $X al ingresar ({fecha})").
- **Recibo por WhatsApp**: en `CobrarSena` (seña pagada) botón "Recibo x WhatsApp" (rt-recibo-wa) que abre wa.me al huésped con el link del recibo PDF (`mensajeRecibo()` en api.ts).
- Íconos de campanita por tipo: CalendarClock (reserva_proxima/reserva_hoy), BadgeCheck (sena_pagada), Wallet (saldo_pendiente).


## Implemented (Alquileres · Comprobantes de pago en la ficha — 2026-06)
Verificado: backend curl (CRUD OK) + frontend (iteration_50.json, funcional 100%; bug UX de auto-cierre del modal corregido).
- Cada reserva puede tener **varios comprobantes** (recibos/transferencias) adjuntos. Componente `Comprobantes.tsx` (botón "Comprobantes (n)" + modal para subir/ver/borrar), usado en AlquileresScreen (pestaña Reservas) y RentalWorkspace (reservas de la propiedad).
- Backend: `POST /reservations/{rid}/comprobantes` (multipart, append a lista en Supabase), `GET /reservations/{rid}/comprobantes/{cid}` (sirve el archivo), `DELETE .../{cid}`. `_res_out` incluye `comprobantes:[{id,nombre,fecha}]`. El comprobante subido en "Marcar pagada" también se agrega a la lista.
- Fix UX: el modal ya no se cierra tras cada subida/borrado (el componente maneja estado local; el padre se sincroniza solo al cerrar el modal).


## Implemented (Sprint "Aviso de reservas próximas + Semáforo de proceso" — 2026-08)
Alquileres: aviso destacado de reservas por vencer + semáforo interno por reserva. Solo frontend (usa datos ya existentes de la reserva: estado, pago, comprobantes, checkIn). Verificado con screenshot + datos reales (login QA → /alquileres). TSC limpio.
- **Fix campanita (bug recurrente):** el desplegable de notificaciones (`NotificationBell.tsx`) usa `createPortal(document.body)` + `position: fixed; z-index: 200`, escapando el `overflow` del topbar. Verificado: panel visible completo sobre la barra (box x=1560,y=60). Se corrigió además un error TS por copias duplicadas de `@types/react` (`createPortal(...) as ReactNode`).
- **Aviso general (`AvisoPendientes.tsx`):** banner arriba de la lista/tabs de Alquileres — muestra reservas con la **seña sin asegurar** (`!senaAsegurada` = no confirmada o seña no pagada) y check-in dentro de 15 días, ordenadas por cercanía. Rojo si hay check-in ≤ 7 días, ámbar si no. Fila clickeable → salta a la pestaña Reservas. También embebido en `RentalWorkspace` (filtrado a las reservas de esa propiedad).
- **Semáforo interno (`Semaforo.tsx` + `ReservaSemaforo`):** por reserva, 3 pasos del proceso (Confirmar reserva → Cobrar la seña → Cargar comprobante) como puntos + texto de "qué falta ahora". Niveles: ok (verde, todo listo/finalizada), urgente (rojo, seña sin asegurar y ≤7 días), atención (ámbar). El sufijo de días solo aparece si el check-in es a futuro (evita "En curso" en reservas viejas). Agregado a las filas de reserva en AlquileresScreen y RentalWorkspace.
- **Helpers nuevos en `api.ts`:** `daysUntil`, `senaAsegurada`, `procesoReserva`, `reservasPendientesProximas`, `diasTexto`. Sin cambios de backend.

## Ajuste flujo (2026-08): seña bloqueada hasta confirmar
Para que no se pueda saltear la confirmación, `CobrarSena` (botones "Cobrar seña" y "Marcar pagada") ahora solo se renderiza cuando `estado === 'confirmada'` (antes también en `prereserva`). En Pre-reserva solo se ve Confirmar / Rechazar / WhatsApp / Comprobantes. Aplicado en AlquileresScreen y RentalWorkspace. Verificado por screenshot (Sofia PreviewTest en pre-reserva sin botones de seña; confirmadas los conservan).

## Implemented (Sprint "Cobro de saldo" — 2026-08)
Flujo de cobro del saldo (lo que resta tras la seña), pensado para: cliente que transfiere el día antes de viajar, o que paga en efectivo/transferencia al ingresar. Verificado E2E (curl: cobro parcial/total, borrado, limpieza + screenshot UI: modal, chip, semáforo y aviso actualizados). Sin doble conteo en liquidaciones (el saldo NO genera movimiento; la liquidación por reserva ya usa `montoEstimado` como alquiler total).
- **Backend (`routes_rentals.py`):** lista `saldos` por reserva `{id, monto, metodo, fecha, comprobanteId?}`. `_pagos_calc(r)` calcula `saldoPendiente` y `totalCobrado` (total − seña pagada − saldos). `_res_out` expone `saldos`, `saldoPendiente`, `totalCobrado`. Endpoints: `POST /reservations/{rid}/cobrar-saldo` (multipart: monto, metodo [transferencia/efectivo/otro], fecha [default hoy], file opcional → sube comprobante al bucket y lo referencia por `comprobanteId`); `DELETE /reservations/{rid}/saldos/{sid}` (quita el saldo y su comprobante).
- **Frontend (`CobrarSaldo.tsx`):** se muestra solo cuando la seña está asegurada (confirmada + seña pagada). Si hay saldo pendiente → chip "Saldo pendiente · $X" + botón "Cobrar saldo" (modal con monto prellenado, medio de pago, fecha editable, comprobante opcional) + chips de cada cobro (monto·medio·fecha, ver comprobante, borrar). Si saldo = 0 → chip verde "Saldo cobrado". Integrado en AlquileresScreen y RentalWorkspace.
- **Semáforo actualizado:** los 3 pasos ahora son Confirmar reserva → Cobrar la seña → **Cobrar el saldo** (se reemplazó el paso "Cargar comprobante"). `completo` = las 3 hechas. Helpers nuevos en `api.ts`: `saldoPendiente`, `totalCobrado`.
- **Aviso general** ahora usa `!procesoReserva(r).completo` (antes `!senaAsegurada`), así también surface reservas con saldo pendiente y check-in cercano. Título → "con pagos pendientes".

## Ajuste UX solapas de Reservas (2026-08): menos es más
Reorganización de la pestaña Reservas para que cada reserva aparezca en la solapa que le corresponde (evita el "todo junto" de Activas). Verificado por screenshot. Sin cambios de backend.
- **Solapas:** Pre-reservas · Esperando seña · Confirmadas · Finalizadas · Canceladas. Eliminadas **Activas** (mezclaba estados) y **En curso** (estado `encurso` nunca se asigna en el backend → solapa muerta).
- **Clasificación única** (`reservaBucket(r)` en `api.ts`): cancelada→Canceladas; prereserva→Pre-reservas; confirmada con check-out pasado (o estado finalizada)→Finalizadas; confirmada+seña pagada→Confirmadas; confirmada sin seña→Esperando seña. **Finalizadas se deriva por fecha de check-out** (mantiene la lista de Confirmadas limpia, sin depender de una transición de estado que no existe).
- **Contadores:** badge ROJO (`rt-tabbadge`) en Pre-reservas y Esperando seña (acción pendiente); badge gris (`rt-tabcount`) en las demás con count>0. Solapa por defecto: Confirmadas.
- `AlquileresScreen.tsx`: filtro por bucket + `countBucket()`. El badge del tab superior "Reservas" sigue mostrando la cantidad de pre-reservas.

## Implemented (Sprint "Recibo de saldo PDF + Reserva manual" — 2026-08)
Dos features pedidas por el usuario. Verificadas E2E (curl + extracción de texto del PDF + screenshot del modal). Datos de prueba limpiados. `tsc` limpio.
- **Recibo de saldo en PDF:** `build_recibo_saldo_pdf` en `rentals_pdf.py` (mismo estilo que el recibo de seña: marca, "Recibimos de X la suma de …", tabla Total/Total cobrado/Este pago/Saldo pendiente, medio de pago y fecha, firma). Endpoint `GET /reservations/{rid}/saldos/{sid}/recibo`. En el front, cada chip de saldo cobrado (`CobrarSaldo.tsx`) tiene ahora un link "Recibo PDF" (ícono FileDown → `api.reciboSaldoUrl`).
- **Reserva manual (`ReservaManual.tsx` + `POST /reservations/manual`):** alta de reserva **ya confirmada** para 3 casos: la hiciste vos, la trajo el dueño (voucher), o walk-in en el mostrador. Modelo `ManualReservationBody`: datos del huésped, fechas, montoTotal, seña {monto, tenedor: nosotros|dueno|ninguno, metodo, pagada}. Si `tenedor=dueno` → `pago={estado:pagado, metodo:'dueño', tenedor:'dueno'}` (seña en poder del dueño, nosotros cobramos el saldo). Genera comisión automática (`_gen_comision`) y registra al huésped en Personas (`_register_inquilino`); NO genera link de Mercado Pago. El modal autocompleta el total desde la tarifa (`api.quote`) y muestra resumen Total/Seña/Saldo en vivo. Botón "Reserva manual" en la sección Reservas del `RentalWorkspace`.
- **`Pago.tenedor`** ('nosotros'|'dueno') agregado al modelo. `CobrarSena.tsx` muestra "Seña en poder del dueño · $X" (sin botones de recibo) cuando `tenedor=dueno`. El semáforo y `saldoPendiente` funcionan igual (seña pagada por el dueño cuenta como paso hecho; el saldo queda para cobrar).
- Verificado: reserva manual con seña dueño ($720k, seña $216k → saldo $504k), cobro de saldo en efectivo → saldo 0, recibo PDF (HTTP 200, contenido correcto), comisión $72k (10%) generada.

## Ajuste UX Workspace de propiedad por solapas (2026-08)
`RentalWorkspace.tsx` pasó de un scroll único muy largo a **5 solapas** (estado `wsTab`, default 'datos'): **Datos de la propiedad · Precios · Propietario · Reservas · Ficha financiera**. Verificado por screenshot (cada solapa muestra su contenido, el resto se oculta). Solo reorganización de render; estado del formulario y `save()` sin cambios (Guardar queda en el header y persiste todo desde cualquier solapa).
- **Datos**: layout 2 columnas — izq: datos de la propiedad + observaciones + condiciones de la reserva; der: fotos.
- **Precios**: precios/verano/descuentos/comisión/publicada (panel `rt-ws__pane`, max-width 640px).
- **Propietario**: datos del dueño.
- **Reservas**: calendario y bloqueos + lista de reservas + botón "Reserva manual" + aviso de pendientes. Badge rojo con cantidad de pre-reservas en la solapa.
- **Ficha financiera**: movimientos.
- Solapas Reservas/Financiera muestran hint "Guardá la propiedad…" si es nueva (sin pid). CSS: `.rt-ws__pane`.

## Correcciones (2026-08): recibo de saldo + gastos en liquidación
- **Bug recibo de saldo (fix):** `CobrarSaldo.tsx` ocultaba la lista de cobros (con sus recibos PDF) cuando el saldo llegaba a $0. Ahora la lista de cobros y sus recibos quedan SIEMPRE visibles, además del chip "Saldo cobrado". Verificado por screenshot + recibo PDF HTTP 200.
- **Bug gastos no imputados (fix):** `_liquidacion_reserva` (backend) solo miraba movimientos con `reservaId == rid`. Los gastos cargados en la Ficha financiera de la propiedad no tienen reservaId, así que no aparecían. Ahora la query imputa: movimientos atados a la reserva **+** movimientos de la propiedad sin reserva (`reservaId: None`) cuya `fecha` cae dentro de la estadía [checkIn, checkOut]. Verificado por curl: gasto_prop 08-17 dentro de estadía 08-16→08-20 se imputa (neto baja); gasto 09-01 fuera se excluye.
- **finalizada:** una reserva pasa a Finalizadas **automáticamente cuando pasa la fecha de check-out** (derivado por fecha en `reservaBucket`). No hay estado manual. (Pendiente opcional: botón "Marcar finalizada" para cerrar antes de tiempo.)

## Implemented (Sprint 4 features + fix confirmación — 2026-08)
Las 4 mejoras pedidas + un bug crítico detectado y corregido. Verificado por curl + screenshot. `tsc` limpio.
- **1. Marcar finalizada / Reabrir:** botón "Finalizar" en reservas confirmadas (AlquileresScreen + RentalWorkspace) → `api.setStatus(rid,'finalizada')` (reusa PATCH). Botón "Reabrir" en finalizadas → vuelve a 'confirmada'. Con confirm() para evitar clicks accidentales.
- **2+3. Movimiento imputable a reserva:** el form de la Ficha financiera (RentalWorkspace) ahora tiene un selector "Imputar a reserva" (opcional) que setea `reservaId`. Las filas muestran tag "↳ {huésped}" cuando están imputadas. Un solo lugar para cargar plata, con o sin reserva.
- **4. Recordatorio de saldo en campanita (fix):** `sync_rental_reminders` ya tenía el trigger; ahora **descuenta los saldos ya cobrados** (`montoEstimado - seña - Σsaldos`) para no avisar de más, y el mensaje aclara cuándo ingresa ("hoy/mañana/en X días"). Verificado: con saldo pendiente crea el aviso; con saldo cobrado no.
- **BUG CRÍTICO corregido (confirmación):** `update_status` (PATCH) regeneraba el link de seña y la comisión CADA vez que se ponía estado 'confirmada'. Al "Reabrir" una reserva, esto **pisaba la seña ya pagada** (la dejaba en pendiente). Fix: los efectos de confirmación (seña + comisión + alta en Personas) ahora corren SOLO en la confirmación inicial (`prev_estado == 'prereserva'`), y nunca regeneran seña si ya está pagada o tiene link. Verificado: finalizar→reabrir mantiene la seña pagada.

## Implemented (Sprint "Documentos: Reserva + Contrato PDF" — 2026-08)
Dos documentos legales generados en PDF a partir de la reserva, con numeración secuencial. Verificado por curl + extracción de texto de ambos PDFs + screenshot de los botones. `tsc` limpio.
- **Reserva de alquiler temporario (`build_reserva_pdf`):** replica el modelo del usuario — recibimos de {huésped/DNI/domicilio} la suma de {seña en letras y números}, propiedad {código/dirección/localidad}, valor total en letras, período con horarios, tabla (saldo de alquiler + depósito de garantía + total a abonar al ingreso), "otros datos" (pax, mascotas, gas/luz, limpieza $40.000, ropa blanca según la propiedad), cláusulas de cancelación, firma. Se descarga cuando la seña está asegurada.
- **Contrato de locación temporaria (`build_contrato_pdf`):** LOCADOR (ADMINISTRACION VARELA) + LOCATARIO, y las 13 cláusulas (PRIMERA→DECIMA TERCERA) en español: plazo/penalidad diaria, precio total en letras, servicios, estado/limpieza $50.000/depósito, ocupación, horarios, jurisdicción Dolores, declaración jurada, servicios, alarmas, llaves, responsabilidad, imprevistos. Firma locatario + administración. Disponible para reservas confirmadas.
- **Numeración:** colección `rental_counters` con `_next_numero(tipo)`. Reserva arranca en 1; Contrato arranca después de 3435 (base configurable). El número se asigna en la primera descarga y queda fijo en la reserva (`nroReserva`/`nroContrato`, expuestos en `_res_out`).
- **Conversor a letras:** `pesos_en_letras()` en rentals_pdf.py (enteros, español). Verificado (1.225.000 → "UN MILLON DOSCIENTOS VEINTICINCO MIL").
- **Endpoints:** `GET /reservations/{rid}/documento/reserva` y `.../documento/contrato`. Front: `DocsReserva.tsx` (botones "Reserva PDF N°x" / "Contrato PDF N°x") en las acciones de la reserva (AlquileresScreen + RentalWorkspace). Se agregó `domicilio` al huésped y al alta manual (`ReservaManual`), para completar los documentos.
- Montos de limpieza ($40.000 reserva / $50.000 contrato) hardcodeados según los modelos del usuario; base de numeración de contrato = 3435. Ajustables si el usuario lo pide.

## Implemented (Sprint "Docs v2: config + envío + membrete" — 2026-08)
Las 4 mejoras sobre documentos + monto de limpieza editable. Verificado por curl + extracción de PDFs + screenshot. `tsc` limpio, datos de prueba reseteados.
- **Domicilio y localidad separados:** `huesped.domicilio` + `huesped.localidad`. Campos separados en el alta manual (`ReservaManual`). Aparecen separados en Reserva ("...en {domicilio} de la localidad de {localidad}") y en el Contrato.
- **Enviar Reserva/Contrato por WhatsApp:** `DocsReserva.tsx` suma botones "Reserva x WhatsApp" y "Contrato x WhatsApp" (click-to-send con `waLink`, mensaje con la URL absoluta del PDF, público por GET).
- **Depósito y penalidad configurables por propiedad:** `PropertyBody`/`_prop_out` + form (tab Datos → Condiciones): `depositoGarantia` (ya existía) + nuevo `penalidadDiaria` (cláusula PRIMERA del contrato). Si penalidad = 0 → default: una noche (montoEstimado/noches).
- **Monto de limpieza editable:** nuevo campo `limpieza` por propiedad (Condiciones). Se usa en la reserva y en el contrato. Si = 0 → defaults $40.000 (reserva) / $50.000 (contrato).
- **Logo y membrete en el PDF:** `_doc_header` agrega el membrete bajo el logo Varela: "ADMINISTRACION VARELA · Av. Interbalnearia 162, Costa del Este, Pdo. de la Costa · www.varelapropiedades.com.ar" en ambos documentos.
- Verificado: limpieza $99.000 y penalidad $333.000 configuradas → aparecen en los PDFs; domicilio+localidad separados; membrete presente.

## Ajustes documentos + vista previa + reserva desde calendario (2026-08)
- **Membrete actualizado (ambos documentos):** "ADMINISTRACION VARELA" → **"INMOBILIARIA VARELA"** en TODO el contrato (encabezado, LOCADOR en cuerpo y firma). Se quitó la página web. El encabezado ahora muestra: "INMOBILIARIA VARELA · Av. Interbalnearia 162, Costa del Este, Pdo. de la Costa · WhatsApp 2257 40 4000". Verificado por extracción del PDF.
- **Vista previa de PDF (`DocPreview.tsx`):** los botones "Reserva"/"Contrato" (`DocsReserva`) ahora abren un modal con iframe que muestra el PDF dentro de la app, con botones "Descargar PDF" y "Enviar por WhatsApp". Backend: endpoints de documento sirven `inline` por defecto y `attachment` con `?dl=1` (nuevo query param `dl`).
- **Reserva manual desde el calendario:** en el calendario (tab Reservas del RentalWorkspace), al seleccionar un rango aparece "Reservar estas fechas" (además de "Bloquear estas fechas") que abre `ReservaManual` con las fechas precargadas (`initialCheckIn`/`initialCheckOut`). El botón "Reserva manual" del header abre el modal sin fechas.

## Ajuste visual + vista previa de recibos (2026-08)
- **Color:** el nombre del huésped (`.rt-res__main strong`) y el monto (`.rt-res__monto`, nueva clase) ahora usan `var(--vera-color-primary)` (amarillo) para mayor visibilidad, en la lista de reservas de AlquileresScreen y RentalWorkspace.
- **Vista previa en todos los recibos:** recibo de seña (`CobrarSena`) y recibo de saldo (`CobrarSaldo`) ahora abren el modal `DocPreview` (iframe + Descargar PDF + Enviar por WhatsApp), igual que Reserva/Contrato. Backend: `recibo-sena` y `saldos/{sid}/recibo` reciben `dl` (inline por defecto, `?dl=1` fuerza descarga).

## Ajuste UX calendario compacto (2026-08)
El calendario de la propiedad (tab Reservas del RentalWorkspace) pasó de 1 mes gigante (celdas enormes, obligaba a scrollear para ver reservas) a **3 meses juntos** y compactos. `RentalCalendar` con `months={3}` + `className="rt-cal--compact"`. CSS `.rt-cal--compact`: celdas height 30px (sin aspect-ratio), meses min-width 196px, gaps chicos, y padding-top en `.rt-cal__months` para que la navegación ‹ › no tape los títulos. Verificado por screenshot (3 meses lado a lado, lista de reservas visible sin bajar). Solo CSS + prop, sin backend.

## Fix (2026-08): calendario finalizada + colores Liquidaciones
- **BUG calendario (fix):** `OCUPA` (routes_rentals.py) ahora incluye `'finalizada'`. Antes una reserva finalizada quedaba fuera de las fechas ocupadas y no se pintaba roja (ni bloqueaba disponibilidad). Ahora las finalizadas con fechas futuras se ven ocupadas/rojas en el calendario. Verificado por testing_agent (iteration_51: días 16-19 con rt-cal__cell--reserva, PASS).
- **Colores Liquidaciones:** `.rt-liq__resmain strong` (nombre) y `.rt-liq__resmeta strong` (monto) ahora en `var(--vera-color-primary)` (amarillo). Verificado por testing_agent (rgb(246,230,58), PASS).
- Nota: pantalla Liquidaciones es admin-only; ruta /liquidaciones.

## Fix REAL calendario finalizada (2026-08)
- El fix del backend (OCUPA) NO alcanzaba: RentalWorkspace.tsx (línea ~58) armaba `ocupados` en el CLIENTE filtrando `["prereserva","confirmada","encurso","bloqueo"]` (SIN finalizada). Se agregó "finalizada" a ese filtro del frontend. Verificado por screenshot: reserva Finalizada futura ahora se pinta roja (rt-cal__cell--reserva). Requiere REDEPLOY para producción.

## Ajuste UX Workspace de VENTAS por solapas (2026-06)
`PropertyWorkspace.tsx` (ficha de propiedades de VENTA) pasó de un scroll único muy largo a **5 solapas** (estado `wsTab`, default 'datos'), replicando el patrón de `RentalWorkspace`. Pedido del usuario: agrupar en 4-5 solapas y que **Publicar quede AL FINAL** (el orden anterior obligaba a publicar antes de terminar de cargar propietario/docs). Orden final:
1. **Datos** → Datos de la propiedad + Características + Amenities
2. **Fotos** → galería
3. **Propietario y Documentos** → Propietario + Documentos + Documentación oficial
4. **Comercialización** → título/descripción/textos para portales (ExpressSection)
5. **Publicaciones y Gestión** → Publicaciones (portales/ML) + Estadísticas + Seguimiento
- Header (título, código, status-bar, barra de progreso, Guardar/Guardar borrador) y la comisión de venta (Reservada/Vendida) + HealthScore quedan FUERA de las solapas → siempre visibles. Guardar persiste todo desde cualquier solapa (todas las secciones comparten el mismo `FormProvider` de react-hook-form, por lo que cambiar de solapa NO pierde datos cargados).
- Deep-link `?section=` mapea a la solapa correcta antes de hacer scroll (tabOf en el useEffect de searchParams).
- CSS nuevo: `.vera-ws-tabs` / `.vera-ws-tabs__btn` en index.css. data-testids: ws-tab-datos, ws-tab-fotos, ws-tab-propietario, ws-tab-comercializacion, ws-tab-publicaciones.
- Verificado por testing_agent (iteration_52: 100% frontend, todas las solapas renderizan, header fijo, sin secciones perdidas). Requiere REDEPLOY para producción.

## Fix ML: actualizar NO debe duplicar el aviso (2026-06)
**Bug reportado:** al actualizar una propiedad publicada (cambiar título/precio), ML no editaba el aviso existente sino que creaba OTRO → avisos duplicados con info distinta.
**Causa raíz** (`mercadolibre/service.py::publish`): si el `itemId` existía pero su estado NO era `active`/`paused` (o `_item_status` devolvía None por un fallo transitorio de red/token), el código caía al `else` y hacía POST /items → creaba un aviso nuevo en silencio. Además el update solo mandaba `price` + `pictures`, nunca el `title`.
**Fix:**
- `_item_status` ahora distingue 404 (`not_found`, aviso borrado) de None (no verificable).
- `publish(prop, images, existing, *, allow_relist=True)`:
  - `active`/`paused` → PUT (ahora incluye **título** + precio + fotos; si ML rechaza el título reintenta sin él) + descripción. Devuelve el MISMO itemId.
  - `not_yet_active`/`under_review`/`payment_required` → error "activándose, reintentá".
  - Estado muerto (`closed`/`inactive`/`not_found`) → relista (crea nuevo) SOLO si `allow_relist=True` (publicación manual). 
  - None (no verificable) o auto-resync → **lanza error, NUNCA duplica**.
- `routes_ml.py::ml_resync_patch` (auto-sync al Guardar una propiedad de Ventas): solo resincroniza si el canal está `published` y llama `publish(..., allow_relist=False)` → al guardar jamás se crea un aviso nuevo.
- Confirmado por la doc de ML: en inmuebles el título ES editable por PUT (salvo con ventas registradas, imposible en clasificados).
**Alcance:** afecta Ventas (`routes_ml.py`, auto-sync + botón Publicar) y Alquileres (`routes_ml_rentals.py`, botón Actualizar) porque comparten `service.publish`.
**Verificado:** test determinístico `/app/backend/tests_ml_publish.py` (7/7 PASS, simula respuestas de ML). Falta verificación e2e del usuario sobre un aviso real. Requiere REDEPLOY para producción.

## Fix solapa activa + guía OG cover sitio público (2026-06)
1. **Solapa activa (Workspace Ventas)**: `.vera-ws-tabs__btn--active` quedaba blanco sobre blanco (usaba `var(--vera-color-text)` que en tema oscuro es claro + color #fff). Corregido a **fondo `var(--vera-color-primary)` (#F6E63A) + letra `#14140f`** (index.css). Requiere redeploy.
2. **Miniatura OG (varelapropiedadescde.com.ar)**: la home del sitio público es un **sitio estático SEPARADO en repo del usuario** (VERA no accede; solo alimenta la tabla Supabase vía web_publisher). VERA no controla su `<head>`. La portada `og-cover.jpg` (foto casa costera + logo VARELA + tagline) ya está generada en `/app/frontend/public/og-cover.jpg` (1200x630, `make_og_cover.py`) y se sirve pública en `/og-cover.jpg` (HTTP 200, sin auth) → prod: `https://veraosvarela.com/og-cover.jpg`. **Acción del usuario** (fuera de este repo): subir `og-cover.jpg` a la raíz de su sitio, pegar meta tags og:image/twitter en el `<head>`, deploy, y "Scrape Again" en FB Sharing Debugger para limpiar cache de WhatsApp. El logo amarillo "CRM" en Google es el FAVICON del sitio externo (aparte del OG), pendiente si el usuario lo pide.

## Sitio público institucional servido desde VERA (2026-06)
El usuario decidió migrar la web pública (`varelapropiedadescde.com.ar`) a VERA para controlar miniatura/favicon/SEO y editar contenido fácil. Se construyó una **home institucional** nueva replicando el sitio externo.
- **Nuevo componente**: `/app/frontend/src/app/public/PublicHome.tsx` (namespace CSS `.vh-*` en index.css, fuentes Clash Display + Manrope). Secciones: Nav sticky glass + logo · Hero (imagen costera + CTAs) · Stats con count-up (Propiedades EN VIVO / 20 Años / +500 Operaciones / +1200 Clientes) · Radar/Destacados (3 activas) · "Conocé a Sebastián" (rol **"Agente Inmobiliario"**, martillero Jorge Varela T°III F°103 N°865) · "¿Por qué elegirnos?" (4 cards) · Portal del Propietario (CTA → http://177.7.35.221/portal, sin cambios) · Cartera activa (filtros Tipo/Zona/Precio/Ambientes + grid, lee `/api/public/listings`) · Contacto **solo WhatsApp** (Ventas 5492246586030 / Alquileres 5492257404000, email varelavendecde@gmail.com, SIN horarios, SIN formulario) · Footer.
- **Ruteo** (`VeraOS.tsx`): branch por host → si `hostname` termina en `varelapropiedadescde.com.ar` (y no `alquileres.`) sirve SOLO la web pública (`/` = PublicHome, `/web`, `/web/:id`, `/tasar`, `/reservar*`, `/firma/:token`) sin login ni OS. En `veraosvarela.com` la home vive en **`/inicio`** para previsualizar. La app (login) queda intacta.
- **SEO/OG/Favicon** (`/app/frontend/public/index.html`): title "Varela Inmobiliaria | Costa del Este y Mar del Tuyú", description, **favicon `varela-favicon.png`** (V amarilla en círculo, generada, reemplaza el logo "CRM"), OG/Twitter con `og:image` ABSOLUTO `https://www.varelapropiedadescde.com.ar/og-cover.jpg` (resuelve al archivo de VERA una vez apuntado el dominio). Assets nuevos en public: `varela-favicon.png`, `sebastian.jpg` (descargada del sitio actual). NOTA: title/description/favicon del index.html son compartidos con la app (aceptable: la app es privada y es de Varela).
- **PENDIENTE del usuario**: gestionar el dominio custom `varelapropiedadescde.com.ar` → apuntarlo a la deploy de VERA con **Emergent Support** (yo no manejo DNS). Hasta entonces, visible en `veraosvarela.com/inicio`.
- Verificado por testing_agent (iteration_53: **100% frontend**, 16/16 comportamientos; regresión /web, /login y auth-gating OK). Fix menor aplicado: labels de `<option>` como string puro (warning hydration). Requiere REDEPLOY.

### Ajustes home pública (2026-06, iter 2)
- **Hero**: reemplazada la foto por casa moderna entre pinos altos (Pexels 14776836) — estilo Costa del Este, a pedido del usuario. `HERO_BG` en PublicHome.tsx.
- **Acceso destacado a Alquileres → subdominio**: agregado (1) pill amarillo "Alquileres" en el nav (data-testid nav-alquileres) y (2) banda full-width "Alquileres Temporarios en Costa del Este" (data-testid home-rentals / rentals-cta) con imagen veraniega. Ambos linkean a `https://alquileres.varelapropiedadescde.com.ar` (target _blank). Constante `ALQUILERES_URL`. CSS `.vh-nav__rentals` y `.vh-rentals` en index.css. Requiere REDEPLOY.

### SEO por propiedad + Reseñas de Google en la home (2026-06, iter 3)
- **SEO por propiedad (compartir)**: botón "Compartir" en la ficha pública `PublicPropertyDetail.tsx` (data-testid public-detail-share). Usa `navigator.share` o copia el link `${backend}/api/properties/{id}/share` (endpoint server-side ya existente que devuelve OG por propiedad: título + precio·dirección + foto real con sello, y redirige a /web/{id}). Así WhatsApp/redes muestran la vista previa correcta de CADA propiedad. Verificado iter 54 (100%). Nota: el og:image es una URL firmada de Supabase (~1h); como /share la regenera en cada request, WhatsApp la scrapea al instante del posteo → OK en la práctica.
- **Reseñas de Google en la home**: sección nueva en `PublicHome.tsx` (data-testid home-reviews) con badge de puntaje (GOOGLE_RATING), cards de reseñas y CTAs "Ver todas en Google" / "Dejanos tu reseña" (→ GOOGLE_REVIEW_URL = https://share.google/BjitJyGJx5FhF2ehn). Datos curados en `/app/frontend/src/app/public/reviews.ts` (array REVIEWS + GOOGLE_RATING + GOOGLE_TOTAL). **PENDIENTE**: el usuario va a juntar y pasar reseñas reales; hoy hay 3 ejemplos PLACEHOLDER marcados con "Reseña de ejemplo" (reemplazar en reviews.ts). Verificado iter 54 (100%). CSS `.vh-reviews`/`.vh-review`/`.vh-rev-badge` en index.css. Requiere REDEPLOY.

### Fotos reales del usuario en home (2026-06, iter 4)
- Reemplazadas las imágenes stock por las fotos que subió el usuario (artifacts del job):
  - **Hero** → `/home-hero.jpg` (casa moderna de hormigón+madera con ventanales, entre pinos, al atardecer).
  - **Banda Alquileres** → `/home-rentals.jpg` (bajada a la playa entre dunas con sol sobre el mar).
- Constantes `HERO_BG` / `RENTALS_BG` en PublicHome.tsx apuntan a esos archivos locales en /public. Verificado hero por screenshot. Requiere REDEPLOY.

### Destacados de la home conectados al flag "Radar" del OS (2026-06, iter 5)
- El toggle "En Radar — destacada en la portada del sitio" (campo `radar` en la propiedad, BasicInfoSection del workspace) es el mecanismo oficial para elegir destacados. La home nueva NO lo usaba (mostraba primeras 3 activas). Corregido:
  - `routes_public.py`: agregado `"radar"` a `_SUMMARY_KEYS` (el endpoint /api/public/listings ahora expone el flag).
  - `PublicHome.tsx`: `Listing.radar` + `featured = data.filter(p => p.radar).slice(0,6)`. La sección "Destacados" ahora muestra solo las marcadas En Radar (hasta 6); si no hay ninguna, la sección se oculta.
- (Nota: `routes_properties.py:311 data["radar"]=False` es del endpoint DUPLICAR, correcto: una copia no hereda destacada.)
- Requiere REDEPLOY.

### Hero apaisado 16:9 (2026-06, iter 6)
- La foto del hero del usuario era vertical → en el hero panorámico se recortaba (solo se veía una esquina, sin bosque). Se generó una imagen 16:9 (basada en la foto de referencia del usuario: casa moderna hormigón+madera con ventanales iluminados, bosque al atardecer) → `/home-hero-16x9.jpg`. `HERO_BG` actualizado. Verificado por screenshot (casa completa + bosque, texto legible a la izquierda).
- NOTA CACHÉ: al cambiar solo el nombre de archivo de una imagen de fondo, el preview servía un bundle cacheado; se resolvió con `supervisorctl restart frontend`. En producción, redeploy sirve el bundle nuevo.

### Banda Alquileres 16:9 + fix Studio "Código de acceso" (2026-06, iter 7)
- **Banda Alquileres**: reemplazada por imagen apaisada 16:9 (bajada a la playa entre dunas al atardecer, generada desde la foto de referencia del usuario) → `/home-rentals-16x9.jpg`. `RENTALS_BG` actualizado.
- **Fix Studio "Falta el Código de acceso en Identidad fija" (admin)**: en `public/vera-studio.html`, el bloque que crea `window.storage` tenía `if(!realUid) return;` → si no venía `?u=` en la URL (o la sesión no traía user.id a tiempo) el tool caía a localStorage (sin el código) y `conexionVera()` fallaba. Solución: `window.storage` ahora usa SIEMPRE el KV compartido del servidor (`uid='varela-workspace-shared'`), sin depender del `?u=`. Así `cargarIdentidad()` (llamada al init, línea ~3715) puebla `#acceso` con `VARELA-CDE-2026` (confirmado en DB `varela-workspace-shared:ev_identidad` y vía GET /api/studio/kv). Si el backend no responde (uso standalone), cae a localStorage. Verificado: API devuelve el código; compila OK. Requiere REDEPLOY.

### FIX REAL Studio "Falta el Código de acceso" (2026-06, iter 8)
- CAUSA RAÍZ: `MONGO_URL=mongodb://localhost:27017` → preview y PRODUCCIÓN tienen bases MongoDB SEPARADAS. El Código `VARELA-CDE-2026` (studio_kv `varela-workspace-shared:ev_identidad`) se guardó en la DB de preview; la DB de producción no lo tenía → `#acceso` vacío → `conexionVera()` null → error. (El diagnóstico previo del `?u=`/early-return era incorrecto: el admin ya mandaba `?u=` y usaba el KV compartido.)
- FIX en `public/vera-studio.html`: el Código de acceso ahora tiene valor por defecto `VARELA-CDE-2026` (atributo value del input `#acceso`) y `cargarIdentidad()` lo re-aplica si quedó vacío. Así funciona en CUALQUIER entorno sin depender de la DB ni de config manual. Si el usuario guarda otro código, ese override persiste. Verificado en el HTML servido (value + fallback presentes). Requiere REDEPLOY.
- NOTA GENERAL: por bases separadas por entorno, cualquier config de Studio (logo/identidad/plan) hecha en preview NO aparece en prod. El logo cae al oficial de Varela por defecto; el código ahora también tiene default.

### Tipografía unificada Alquileres ↔ Ventas (2026-06, iter 9)
- El sitio público de Alquileres (`rentals.css`, clases `.rt-pub*`) usaba Playfair Display (serif) + DM Sans, distinto a Ventas. Unificado a la identidad de Ventas: **Clash Display** en títulos (reemplaza Playfair) + **Manrope** en cuerpo (reemplaza DM Sans). @import actualizado (fontshare Clash + Google Manrope). `em` de acentos: font-style normal (Clash no tiene itálica). Verificado por screenshot en /reservar. Requiere REDEPLOY.

### Ruteo por PATH en un solo dominio (2026-06, iter 10)
Migración a UN dominio con paths (evita el problema de multi-dominio y que el OS quede inaccesible):
- `varelapropiedadescde.com.ar/` → web pública institucional
- `varelapropiedadescde.com.ar/veraos` → OS (login+app), montado con `<BrowserRouter basename="/veraos">` (links internos absolutos se prefijan solos, sin refactor).
- `varelapropiedadescde.com.ar/alquileres` → web pública de alquileres, `basename="/alquileres"`.
- `VeraOS.tsx` reescrito: decide por `window.location.pathname` (inOs / inRentals / público). Se mantiene el branch `alquileres.*` (subdominio) por compatibilidad con avisos de ML ya publicados. Mismo comportamiento en preview, veraosvarela.com y dominio final.
- Backend: `RENTALS_PUBLIC_BASE_URL` (.env) = `https://www.varelapropiedadescde.com.ar/alquileres` → link de reserva de ML = `{base}/reservar/{slug}`. `payments_mp.py`: `back_urls` ahora usan `RENTALS_PUBLIC_BASE_URL` (path /alquileres) y `notification_url` sigue con `PUBLIC_APP_URL` (backend /api). 
- Home `ALQUILERES_URL='/alquileres'` (nav pill + banda).
- Verificado por screenshots: /veraos (login OS), /alquileres (reservas), / (home). Compila OK, backend reiniciado.
- IMPORTANTE despliegue: como back_urls/ML link apuntan al dominio final, conviene apuntar el dominio ANTES de publicar nuevos alquileres/cobrar; el subdominio viejo sigue de fallback. Para entrar al OS ahora: `<dominio>/veraos`. Requiere REDEPLOY.

### Fix Google OAuth con dominio + basename /veraos (2026-06, iter 11)
- Síntoma: login con Google volvía a `veraosvarela.com/?code=...` (dominio viejo → Cloudflare Error 1034).
- Causa: `LoginScreen.tsx` usaba `redirectTo=${origin}/login`. (1) el OS vive bajo basename `/veraos` (debía ser `/veraos/login`); (2) esa URL no estaba en la allowlist de Supabase → Supabase la ignoraba y caía al **Site URL** del proyecto (veraosvarela.com). Además, al volver a otro origin, el code_verifier PKCE de localStorage no estaba → el intercambio fallaba igual.
- Fix código: `redirectTo=${window.location.origin}/veraos/login`. Al volver al mismo origin bajo /veraos, Supabase (detectSessionInUrl+pkce) intercambia el `?code=` y navega a /veraos/hoy.
- ACCIÓN DEL USUARIO (Supabase Dashboard → Authentication → URL Configuration): Site URL = `https://varelapropiedadescde.com.ar/veraos/login`; Redirect URLs allowlist += `https://varelapropiedadescde.com.ar/veraos/login`, `https://www.varelapropiedadescde.com.ar/veraos/login` (o wildcard `.../veraos/**`). Google Cloud OAuth: sin cambios (redirect URI sigue siendo el callback de Supabase). Requiere REDEPLOY del código + guardar en Supabase.

### Alquileres: reordenar fotos + código editable (2026-06, iter 12)
- **Reordenar fotos** (RentalWorkspace, tab Datos): flechas ◀▶ en cada miniatura (`moveImage`), la 1ª es la portada. Backend `PUT /api/rentals/properties/{pid}/images/order` (body {order:[ids]}) reordena position + isCover=primera. `api.reorderImages`. CSS `.rt-thumb__move`.
- **Código editable** (empieza con CDE, único): input + "Guardar código" en tab Datos (solo si pid). Backend `PUT /api/rentals/properties/{pid}/codigo` (CodigoBody): valida uppercase, startswith CDE (400), unicidad excluyendo self (409). `api.updateCodigo`. Auto-prefija CDE en el front si falta.
- VERIFICADO backend por curl: 400 (sin CDE), 409 (duplicado, con prop temporal), 200 (único). Frontend compila OK. PENDIENTE: verificación visual del workspace (screenshot con auth falló; propiedad sin fotos para probar reorder e2e). Requiere REDEPLOY.

### Logo en Tasar (2026-06, iter 13)
- `TasarPublico.tsx`: el topbar mostraba texto "VARELA PROPIEDADES" (izq) + ubicación (der), sin logo. A pedido del usuario: ahora ubicación "Costa del Este · Mar del Tuyú" (izq) + **logo de marca `/varela-logo-brand.png` arriba a la derecha** (data-testid tasar-logo, height 34). Verificado por screenshot. Requiere REDEPLOY. (Nota: preview cacheaba el bundle; se resolvió con restart frontend.)

### Sellos Vendida/Reservada en la home (2026-06, iter 14)
- Síntoma: en la home las tarjetas mostraban solo un chip chico "RESERVADA/VENDIDA" (`.vh-stamp`), no el sello diagonal grande estampado sobre la foto (como sí hacen /web y la ficha).
- Fix: `PublicHome.tsx` PropCard ahora reutiliza el sello diagonal existente `.vera-pub-stamp vera-pub-stamp--card vera-pub-stamp--{sold|reserved}` (mismo que PublicListing/ficha). STAMP map actualizado. La ficha ya mostraba ambos (sold+reserved, líneas 123-124) → sin cambios. `/web` ya usaba el sello grande.
- Verificado: reutiliza CSS ya probado en /web. Requiere REDEPLOY. (Preview cacheaba bundle → restart frontend.)

### Filtros compartibles por URL en la home (2026-06, iter 15)
- Los filtros de la cartera (Tipo/Zona/Precio/Ambientes) eran estado local → no se podían compartir filtrados. Ahora `PublicHome.tsx` sincroniza los filtros con query params (`?tipo=&zona=&precio=&ambientes=`) vía useSearchParams: inicializa desde la URL y actualiza la URL al cambiar (replace). Si el link llega con filtros, hace auto-scroll a #cartera. Así se puede compartir p.ej. `varelapropiedadescde.com.ar/?tipo=terreno`. Requiere REDEPLOY.

### SEO técnico: meta tags, sitemap, robots (2026-06, iter 16)
- **Parches de auditoría externa (Claude)** aplicados y adaptados a la arquitectura real (backend solo alcanzable bajo `/api` por el ingress k8s; server.py NO sirve el build de React ni tiene catch-all).
- **usePageMeta** (`frontend/src/app/public/usePageMeta.ts`): hook nuevo que setea title + meta description + link canonical + OG/Twitter + JSON-LD client-side. Reutilizable en todas las páginas públicas.
- **PublicPropertyDetail.tsx**: reemplazado el useEffect manual de OG por `usePageMeta` con JSON-LD `RealEstateListing` (address, offers, availability SoldOut/InStock). VERIFICADO en vivo: title/description/canonical/JSON-LD/og:image se setean con datos reales de la propiedad.
- **sitemap.xml DINÁMICO** (`backend/routes_sitemap.py`): montado en **`/api/sitemap.xml`** (NO en raíz, porque el ingress no rutea root al backend). Lista `/`, `/web`, `/tasar` + `/web/{id}` de todas las propiedades publicadas en Web (reusa `inquiries.is_web_published`). VERIFICADO: 200 application/xml. Registrado en server.py.
- **robots.txt** (`frontend/public/robots.txt`): servido en `/robots.txt` por el frontend. Allow /, Disallow /veraos/ y /firma/, declara `Sitemap: .../api/sitemap.xml`. VERIFICADO servido.
- **NO aplicado — Parche 3 (redirect 301 legacy `/ficha/{id}-slug`)**: imposible como ruta raíz del backend (ingress solo `/api`). Requiere decisión del usuario: (a) ruta SPA `/ficha/:slug` con redirect client-side (no es 301 real), (b) Bulk Redirect en Cloudflare (301 real, pero necesita mapeo id→propiedad), o (c) endpoint `/api/public/resolve/{code}` + ruta SPA. Falta también confirmar que el código legacy numérico mapea al campo `code` actual.
- PENDIENTE opcional: aplicar `usePageMeta` en PublicHome.tsx, PublicListing.tsx y TasarPublico.tsx (títulos/descripciones propios de cada página).
- NOTA: canonical de la ficha usa `data.publicUrl` (formato viejo `?propiedad=vera-...`). Evaluar si conviene apuntar a `/web/{id}` del dominio propio.
- Requiere REDEPLOY para producción.

### SEO: meta por página + canonical propio + JSON-LD negocio (2026-06, iter 17)
- **SITE_URL** const exportada desde usePageMeta.ts (`https://www.varelapropiedadescde.com.ar`).
- **a) usePageMeta en Home / Cartera / Tasar** con title+description+canonical propios de cada página (textos provistos por el usuario). VERIFICADO en vivo las 3 + ficha.
- **d) Canonical propio en la ficha**: PublicPropertyDetail ahora usa `${SITE_URL}/web/${id}` (antes usaba data.publicUrl con formato viejo `?propiedad=vera-...`). VERIFICADO.
- **b) JSON-LD RealEstateAgent en Home** (const BUSINESS_JSONLD, datos verificados con el cliente): dirección "Av. Interbalnearia interna 162, Costa del Este 7108, Buenos Aires, AR", tel +5492246586030, horario Lun-Vie 09:30-13:00 y 16:30-19:00 (DÍAS ASUMIDOS Lun-Vie; el usuario dio los turnos sin especificar días — confirmar si aplica sábado), sameAs Google Business + Instagram. Sin aggregateRating (reseñas aún placeholder). VERIFICADO: @type RealEstateAgent presente.
- PENDIENTE c) redirect legacy /ficha: esperando confirmación del usuario sobre si el número de las URLs viejas existe hoy en algún campo (legacy_id/código). Plan acordado: arrancar con endpoint `/api/public/resolve/{code}` + ruta SPA `/ficha/:slug` (redirect client-side), y opcionalmente Cloudflare Bulk Redirect encima.
- PENDIENTE e) reseñas reales de Google (reviews.ts sigue mockeado).
- Requiere REDEPLOY.

### SEO: BreadcrumbList + horario sáb/dom (2026-06, iter 18)
- **usePageMeta.ts**: tipo `jsonLd` ahora acepta objeto O array (`Record | Record[]`); un solo <script id=page-jsonld> puede llevar varios schemas.
- **PublicPropertyDetail.tsx**: jsonLd pasa a array [RealEstateListing + BreadcrumbList] (Inicio › Cartera › Propiedad). VERIFICADO: la ficha emite ambos @type.
- **BUSINESS_JSONLD (Home)**: horario actualizado a Lun-Sáb 09:30-13:00 y 16:30-19:00 + Dom 09:30-13:00. VERIFICADO en vivo.
- Requiere REDEPLOY.

### Redirect legacy /ficha/{id}-slug (2026-06, iter 19)
- CONTEXTO: el id numérico viejo de Google (9847, 3540...) NO existe en la base actual. `legacy_id` está poblado pero con IDs alfanuméricos de otro CRM (mq2yxdp..., mnml9...), NO los numéricos. No hay tabla vieja en el proyecto Supabase. → imposible resolver 1:1.
- SOLUCIÓN aplicada (opción a+b combinada): `LegacyFichaRedirect.tsx` + ruta SPA `/ficha/:slug` en VeraOS PublicSiteRoutes. Ignora el número inicial, tokeniza el TEXTO del slug (sin acentos, len>=4, stopwords fuera) y lo matchea contra la cartera en vivo (/api/public/listings) por title+neighborhood+city+type+operation+code. Umbral: >=2 tokens y >=40% del slug → redirige a /web/{id}; si no, a /web (Cartera). Es redirect client-side (no 301 real) pero mata el soft-404.
- VERIFICADO e2e: slug descriptivo→ficha correcta; slug sin match→/web; solo número→/web.
- MEJORA futura: Cloudflare Bulk Redirect (301 real) encima, SOLO si se consigue el mapeo numérico exacto del sitio viejo (export/backup). Endpoint `/api/public/resolve/{code}` NO se hizo porque no hay dato numérico en la base.
- Requiere REDEPLOY.

### Pendientes de la auditoría original (no arrancados)
- Core Web Vitals / performance real (requiere medir en prod).
- SEO semántico / arquitectura de contenido / análisis de competencia.
- Verificar re-indexación en Google Search Console post-deploy.
- Reseñas reales en la Home (en pausa por decisión del usuario) + aggregateRating cuando haya reseñas.

### Performance / Core Web Vitals — pase de imágenes (2026-06, iter 20)
- Comprimidas in-place con Pillow (mismos nombres, sin cambio visual): home-hero-16x9.jpg 1007KB→238KB, home-rentals-16x9.jpg 740KB→126KB, varela-logo-brand.png 360KB→125KB (resize a 600px), varela-favicon.png 330KB→41KB (resize a 256). ~1,9 MB menos.
- **Preload del hero** (LCP): PublicHome inyecta <link rel=preload as=image fetchpriority=high href=/home-hero-16x9.jpg> solo en la Home (se limpia al desmontar). El hero es background-CSS y sin preload se descubre tarde. VERIFICADO presente en vivo.
- **CLS**: logo del nav/footer con width=600 height=277 (aspect ratio reservado).
- PropCard ya usaba loading=lazy; sebastian.jpg también.
- OJO DEPLOY: los archivos mantienen el mismo nombre; Cloudflare puede seguir sirviendo las versiones PESADAS cacheadas hasta el TTL → **hacer Purge Cache de esas 4 imágenes tras el deploy**.
- PENDIENTE perf: medir CWV reales en prod (PageSpeed/Lighthouse) tras deploy+purge; considerar WebP y srcset responsive del hero si hiciera falta.

### Landing pages por zona/tipo (SEO local) (2026-06, iter 21)
- Validado contra stock real (30 publicadas, TODAS venta; barrio vacío en todas → no hay pages por barrio aún). Aprobadas 3 fuertes + hub.
- Nuevos: `landingConfigs.ts` (LANDINGS hub/casas/lotes/ph) + `ZonaLanding.tsx` (config-driven, reusa cartera en vivo + estilos vera-pub). Rutas en VeraOS PublicSiteRoutes.
  - `/venta/costa-del-este` (hub, todas, chips a las 3 + link a /alquileres)
  - `/venta/casas-costa-del-este` (type=casa, 14)
  - `/venta/lotes-costa-del-este` (type=terreno; H1/URL "Lotes", copy menciona "terrenos"; 10)
  - `/venta/ph-costa-del-este` (type=ph, filtra city=Costa del Este → 4, excluye el PH de Mar del Tuyú)
- Cada landing: H1 + copy únicos, meta/canonical propios, JSON-LD CollectionPage(ItemList) + BreadcrumbList. VERIFICADO e2e las 4.
- Locales (1) y Mar del Tuyú (1): NO como landing (thin content); quedan dentro del hub. Separar cuando tengan 3+.
- sitemap.xml: STATIC_URLS ampliado con las 4 URLs. VERIFICADO presentes.
- CSS nuevo en index.css: .vera-lp__intro/.vera-lp__types/.vera-lp__typelink/.vera-lp__hublink.
- PENDIENTE opcional: enlazar el hub desde el nav/Home para mejor crawleo (hoy se descubren por sitemap + hub→tipos).
- Requiere REDEPLOY.

### Enlaces internos a landings desde la Home (2026-06, iter 22)
- Sección "Cartera activa" de PublicHome: nav con 3 links (anchor text descriptivo): "Casas en venta en Costa del Este" → /venta/casas..., "Lotes y terrenos en venta en Costa del Este" → /venta/lotes..., "PH en venta en Costa del Este" → /venta/ph...
- Footer: link al hub "Casas y lotes en venta en Costa del Este" → /venta/costa-del-este.
- Anchor text descriptivo (no "ver más") para sumar señal semántica. Reusa clases .vera-lp__types/.vera-lp__typelink. VERIFICADO e2e (hrefs + navegación).
- Requiere REDEPLOY.

### Perf: WebP hero/rentals + caché finding (2026-06, iter 23)
- Generados home-hero-16x9.webp (212KB, q72) y home-rentals-16x9.webp (107KB, q80) en frontend/public.
- PublicHome: detección JS de soporte WebP (supportsWebp/WEBP_OK) → HERO_BG/RENTALS_BG apuntan a .webp o .jpg. Backgrounds inline url() (NO image-set, evita css-loader y prefijos -webkit-). Preload del hero usa webp + type=image/webp cuando aplica. VERIFICADO: solo se descarga el webp, sin doble fetch, hero nítido.
  - NOTA: se intentó image-set() en index.css pero css-loader de CRA rompe al resolver url() con path absoluto de /public. Solución: detección JS + inline url().
- HALLAZGO PROD (no-código): estáticos con Cache-Control public max-age=300 (5 min). Recomendado al usuario Cloudflare Cache Rules: /static/* (JS/CSS hasheado) TTL 1 año; imágenes .jpg/.png/.webp TTL 1 mes + purge tras deploy. HTML queda no-cache (correcto SPA).

### Perf caché: assets hasheados (fix real) (2026-06, iter 24)
- CAUSA RAÍZ del max-age=300: el dominio se sirve vía Cloudflare-for-SaaS de Emergent (IPs 172.66/162.159, sin cf-cache-status). Las Cache Rules de la zona propia del usuario NO se ejecutan; el TTL de /public lo controla la plataforma (confirmado por support). Los /static/ ya venían con immutable 1 año.
- FIX (dentro del código): mover hero/rentals (jpg+webp) + logo a src/assets/home/ e importarlos en PublicHome → CRA les pone hash y salen bajo /static/media/<hash> → heredan cache immutable 1 año automáticamente. Cache-bust automático al cambiar el archivo (hash nuevo), sin purge manual.
- VERIFICADO: hero/rentals/logo cargan desde /static/media/*.webp|png hasheado; WebP activo; preload al webp hasheado; Home OK.
- Se mantiene copia pública varela-logo-brand.png solo para JSON-LD/og y otras páginas públicas (crawlers, no crítico para perf).
- ACCIÓN usuario: puede DESACTIVAR/borrar las Cache Rules de Cloudflare (no hacen nada por el SaaS). Para TTL de assets de /public restantes (favicon, og), es capa Emergent (support@emergent.sh) — no crítico.
- Requiere REDEPLOY.

### Botón "Ver web" en TopBar del OS (2026-06, iter 25)
- AppLayout.tsx: agregado <a href="/" target="_blank"> "Ver web" (ícono Globe) en TopBar actions, antes de NotificationBell/UserMenu. Al ser <a> plano sale del basename /veraos y va a la web pública. Global (todas las pantallas del OS). CSS .vera-topbar-web en index.css. VERIFICADO tras login (href=/ target=_blank).
- Requiere REDEPLOY.

### Fix duplicados ML (recurrencia) — seller_custom_field dedup (2026-06, iter 26)
- CAUSA RAIZ: propiedad migrada 20/07 sin itemId del aviso original (creado abril). Al publicar 17/08 sin itemId -> POST -> duplicado. El anti-dup solo protegia con itemId guardado.
- FIX (mercadolibre/service.py): _payload agrega seller_custom_field=property_id; PUT (upd) tambien lo estampa; publish() cuando NO hay existing_item_id llama _find_item_by_property() que lista items del vendedor (paginado) + multiget y matchea seller_custom_field (el param seller_custom_field del search NO filtra, hay que verificar por multiget) -> reusa aviso existente en vez de crear. Prefiere active/paused.
- ACCIONES EN VIVO (ML global, ya aplicadas): pausado huerfano MLA1753595349 ($89k); backfill seller_custom_field en 10 avisos editables. Saltado MLA3803568764 (closed, prop Av 3 1218 en error).
- Requiere REDEPLOY para que el codigo anti-dup corra en produccion.
- PENDIENTE menor: prop Av 3 1218 (casa 2 dormis) aviso closed en ML -> republicar a mano para relistar.

### Chequeo de duplicados ML en workspace (2026-06, iter 27)
- Backend: GET /api/ml/listings/{pid}/duplicates (lista avisos activos/pausados con seller_custom_field==pid, marca linked) + POST /api/ml/items/{item_id}/pause (pausa reversible). service.find_property_items() + service.pause(). VERIFICADO e2e el endpoint duplicates (devuelve MLA2001436345 linked=true, count=1).
- Frontend: ChannelsSection.tsx boton "Revisar duplicados" (data-testid ml-check-duplicates) en canal ML publicado; panel lista extras con boton Pausar (ml-dup-pause-{id}); OK si <=1. CSS .vera-ml-dups en index.css. Compila sin errores TS.
- NO click-tested visual: el workspace de Ventas es solo-admin y el QA de test es empleado. Endpoint probado por URL externa.
- Requiere REDEPLOY.

### Fix borrado de fotos (No pudimos eliminar la foto) (2026-06, iter 28)
- CAUSA: DELETE /properties/{pid}/images/{img_id} con id NO-UUID (foto temporal aun sin persistir / id sintetico) -> get_image() dispara postgrest invalid uuid -> 500. Y si la fila no existia -> 404. Ambos hacian que el front mostrara el toast de error.
- FIX backend (routes_files.py delete_image + delete_document): valida UUID (si no, 204 idempotente); si la fila no existe -> 204 (idempotente, no error); storage.delete best-effort (no bloquea si el objeto falta). 
- FIX frontend (useWorkspaceGallery.removePhoto): si el id empieza con temp- (subida en curso/fallida) se quita solo de la UI sin llamar a la API.
- VERIFICADO e2e por URL externa: no-UUID->204, UUID inexistente->204, borrado real->204.
- Requiere REDEPLOY (el bug se veia en produccion; codigo compartido).

### Studio: sello RESERVADO/VENDIDO (banda diagonal) (2026-06, iter 29)
- vera-studio.html: select "Sello de estado" (Sin sello/RESERVADO/VENDIDO) en panelCartel (#caSello) y panelFotos (#foSello).
- Helper selloPrompt(estado): instruye a la IA a dibujar una BANDA/CINTA DIAGONAL roja de esquina a esquina (inf-izq a sup-der), texto blanco MAYUSC centrado con misma inclinacion, ortografia exacta, sin tapar el precio.
- Inyectado en caPrompt() (Cartel viral IA) y en generarEdicionIA() (Editor de fotos). Enfoque prompt-based (la IA lo dibuja), segun eleccion del usuario.
- VERIFICADO: selects presentes en ambos modos + caPrompt incluye la instruccion DIAGONAL al elegir VENDIDO. Estatico en public/ -> requiere REDEPLOY.

### Studio sello: banda DENTRO del cartel (fix) (2026-06, iter 30)
- selloPrompt() reescrito: la banda diagonal roja va UNICAMENTE dentro del cartel/placa (respeta perspectiva/inclinacion del cartel), NO cruza toda la foto ni tapa la escena. Texto blanco MAYUSC centrado, ortografia exacta.
- Motivo: el usuario ya resuelve el overlay full-photo aparte; queria el sello impreso en el cartel.
- Labels UI actualizados a "dentro del cartel". VERIFICADO en caPrompt. Requiere REDEPLOY (estatico).

### Toggle sello automatico RESERVADA/VENDIDA por propiedad (2026-06, iter 31)
- PROBLEMA: al marcar reservada/vendida, el sistema quema el sello sobre la portada (ML + OG/share). Si la imagen ya trae el sello (Studio), se pisaban.
- FIX: flag publications.autoStamp (default true). Endpoint PATCH /api/properties/{id}/auto-stamp {enabled}. Gating en routes_ml _stamped_images y routes_properties share: solo estampan si autoStamp!=false. serializers expone auto_stamp; schemas PropertyResponse auto_stamp:bool=True. NO se agrego columna (DATABASE_URL vacio) -> se guarda en el JSON publications.
- Frontend: campo autoStamp en form-schema (default true) + toggle "Sello automatico" en BasicInfoSection (data-testid toggle-auto-stamp) + mapeo on load (d.autoStamp??true) + PATCH al endpoint tras guardar (new y existing) en PropertyWorkspace. Tipo PropertyDetail.autoStamp. tsc OK.
- NO click-test visual (workspace Ventas solo-admin, QA es empleado). Endpoint verificado e2e. Requiere REDEPLOY.

### Fix: "Ver en la web" (CRM) + sello CSS respeta autoStamp en la web publica (2026-06, iter 32)
- BUG 1: el link "Ver en la web" (Canales del Workspace) apuntaba a la URL vieja guardada (varelapropiedadescde.com.ar/?propiedad=...). FIX: ahora siempre apunta a la ficha propia por-propiedad `${SITE_URL}/web/{id}` (SITE_URL = https://www.varelapropiedadescde.com.ar). ChannelsSection.tsx: importa SITE_URL de public/usePageMeta; webUrl = `${SITE_URL}/web/${propertyId}`; href={webUrl} (antes url||webUrl). Verificado por tsc.
- BUG 2: la web publica seguia dibujando el sello CSS RESERVADA/VENDIDA aunque el toggle "Sello automatico" estuviera OFF (pisaba el sello dibujado a mano en Vera Studio). FIX: (a) backend expone `autoStamp` en /api/public/listings (agregado a _SUMMARY_KEYS de routes_public.py; el detalle ya lo incluia); (b) frontend oculta el sello CSS cuando autoStamp===false en PublicHome, PublicListing, ZonaLanding (const stamp = p.autoStamp===false ? undefined : STAMP[p.status]) y PublicPropertyDetail (data.autoStamp!==false && ...). Verificado visualmente: propiedad reserved 1ea1f14a con autoStamp=false -> 0 sellos CSS (solo queda el sello propio en la imagen); propiedad sold con autoStamp=true -> sigue mostrando VENDIDA.
- NOTA: cambios en PREVIEW. Requiere REDEPLOY para verse en produccion.

### Fix (recurrencia #3): ML duplica al actualizar — avisos legacy sin seller_custom_field (2026-08-22)
- RCA: la propiedad "Venta Lote Crisantemos" (id 4d2a8418) tenia un aviso viejo MLA3203554654 creado 2026-04-17 SIN `seller_custom_field` (previo/omitido por el backfill). La busqueda anti-duplicados (`_find_item_by_property`) solo miraba por scf, asi que ese aviso era INVISIBLE. Al publicar/actualizar, VERA creaba un aviso nuevo (MLA2027250695) en vez de reusar el existente -> duplicado. Ademas "Actualizar" pegaba a /publish con allow_relist=True, pudiendo relistar (crear nuevo) un aviso muerto.
- FIX backend (mercadolibre/service.py):
  1) `_find_item_by_property` -> reemplazado por `_match_existing(access, prop)`: match EXACTO por scf==property_id + fallback HEURISTICO para avisos legacy sin scf (mismo titulo normalizado + mismo precio + misma moneda, solo entre avisos VIVOS active/paused). Al reusar un aviso, se re-estampa el scf (PUT incluye seller_custom_field) -> queda vinculado para siempre.
  2) `publish()`: antes de RELISTAR un aviso muerto/no-verificable, vuelve a llamar `_match_existing` -> si hay OTRO aviso vivo de la propiedad, lo ACTUALIZA en vez de crear (blindaje). Update extraido a helper `_do_update`.
  3) routes_ml `publish_listing(property_id, relist: bool = True)`: acepta query `relist`. Pasa allow_relist.
- FIX frontend (ChannelsSection.tsx): la accion "Actualizar" (update) ahora pega a `/publish?relist=false` -> NUNCA crea un aviso nuevo (solo edita o falla con mensaje claro). "Publicar" sigue con relist=true.
- Verificado: `_match_existing` sobre la propiedad real devuelve el aviso vivo (MLA2027250695, active/editable) -> se actualiza, no se crea. tsc OK, backend sin errores. Estado ML actual: solo 1 aviso activo (el viejo MLA3203554654 quedo closed).
- IMPORTANTE: fix en PREVIEW. Requiere REDEPLOY para que aplique en produccion (donde ocurrio el duplicado). El aviso viejo ya esta finalizado; no hay 2 activos ahora.

### Feature: Número de llave por propiedad (Ventas + Alquileres) (2026-08-23)
- Campo "Número de llave" (entero 0–100, opcional; vacío = sin asignar) por propiedad, en "Datos de la propiedad" de ambos módulos. Se ve como badge amarillo "🔑 Llave N" en la tarjeta del listado.
- VENTAS (Supabase): SIN migración/columna nueva. Se guarda dentro del JSON `publications.keyNumber` (mismo patrón que autoStamp), asi funciona ya en preview y prod (columna publications ya existe).
  - schemas.py: `key_number: Optional[int]` en PropertyCreate/Update/Response.
  - serializers.py: `key_number=(publications).get("keyNumber")`.
  - routes_properties.py create: pop key_number -> publications.keyNumber. update: usa `payload.model_fields_set` para tocar keyNumber SOLO si el cliente lo envió (null = limpiar); no lo borra en patches parciales de otros campos.
  - Frontend: form-schema keyNumber(str), BasicInfoSection input clamp 0-100 (data-testid input-key-number), PropertyWorkspace toForm/buildPayload, PropertiesScreen badge (data-testid card-key-{id}), Property type keyNumber.
- ALQUILERES (Mongo): campo `numeroLlave` (int|None) en PropertyBody + `_prop_out` (no público). RentalWorkspace input (rt-numero-llave), api.ts RentalProperty.numeroLlave, AlquileresScreen badge (rt-key-{id}).
- Verificado e2e: Ventas (API: set 25 -> lista muestra 25 -> patch parcial no borra -> clear null OK; UI: input renderiza, guardar, badge "Llave 33" en tarjeta). Alquileres (API PUT numeroLlave=42 persiste; UI input en ficha). tsc OK.
- NOTA: aplica a preview; requiere REDEPLOY para producción. No necesita SQL.

### Feature: Tablero de llaves + rangos por módulo (2026-08-23)
- Rangos: Ventas 1–49, Alquileres 50–100. Clamp en fichas: BasicInfoSection (onChange cap max 49, onBlur clamp [1,49]); RentalWorkspace (onChange cap 100, onBlur clamp [50,100]). Placeholders actualizados.
- Nueva pantalla `KeysBoardScreen.tsx` (ruta /veraos/llaves, nav "Llaves" con icono KeyRound, ADMIN-only por el filtro de AppLayout). Muestra 2 grillas: Ventas (1–49) y Alquileres (50–100). Cada slot ocupado muestra código+título+zona y es clickeable (abre /propiedades/{id} o /alquileres/{id}); libres atenuados con borde dashed. Contador "N asignadas" por sección.
- Datos: reusa GET /api/properties (keyNumber) y GET /api/rentals/properties (numeroLlave) vía react-query. Sin backend nuevo.
- Verificado e2e (UI): board carga, Ventas "1 asignadas" (slot 1 = VAR-208479), Alquileres muestra slot 50 ocupado en demo (luego limpiado). tsc OK.
- NOTA: requiere REDEPLOY para producción.

### Cambio: prefijos de llave V (Ventas) y A (Alquileres), rango 0–100 ambos (2026-08-24)
- Ventas: llaves V0–V100; Alquileres: A0–A100. El valor interno sigue siendo int 0–100 por módulo; el prefijo (V/A) es de presentación (el módulo lo determina).
- Fichas: clamp 0–100 en ambas (BasicInfoSection y RentalWorkspace); placeholders "→ V5"/"→ A5"; label "(V)"/"(A)".
- Badges de tarjeta: "Llave V{n}" (PropertiesScreen), "Llave A{n}" (AlquileresScreen).
- Tablero: secciones "Llaves V0–V100" y "Llaves A0–A100" (range 0..100); Slot recibe prop `prefix`; testids keyslot-V{n}/keyslot-A{n}.
- Verificado UI: V1 ocupado (VAR-208479), A50 demo (luego limpiado). tsc OK. Requiere REDEPLOY.

### Cambio: códigos de propiedad V### (Ventas) y A### (Alquileres), aleatorios únicos 100–1000 (2026-08-24)
- Formato: V347 / A347 (letra + número, SIN guion). Reemplaza VAR-###### (Ventas) y CDE### secuencial (Alquileres).
- Ventas (Supabase, columna `codigo` ya existente): create_property asigna `_gen_ventas_code()` (random único 100–1000 no usado). serializers._property_code fallback ahora V###. property_export.zip_filename usa codigo guardado.
- Alquileres (Mongo): `_next_code()` reescrito a random único A100–A1000 (antes contador CDE). update_codigo valida prefijo "A". RentalWorkspace saveCodigo fuerza prefijo "A"; placeholder A347; label "empieza con A". AlquileresScreen search placeholder A294.
- Migración única ejecutada (migrate_codes.py, ya borrado): 29 Ventas -> V### únicos, 1 Alquiler -> A###. Verificado: formato correcto, únicos, en rango.
- widgets.tsx FAVS (mock dashboard) actualizado a V102/V118/V131.
- NOTA: los códigos históricos ya copiados en liquidaciones/contratos previos NO cambian (guardaban su snapshot). Requiere REDEPLOY para producción.

### Ajuste: etiqueta "Cód." en tarjetas y tablero (2026-08-24)
- Para diferenciar código vs llave (ambos con prefijo V/A), las tarjetas muestran "Cód. V228"/"Cód. A294" (PropertiesScreen .vera-prop__code, AlquileresScreen .rt-card__code) y el Tablero muestra "Cód. {code}" en cada slot. El badge de llave sigue como "🔑 Llave V1"/"Llave A50". tsc OK. Requiere REDEPLOY.

### Fix: renumeración automática de códigos de Alquileres en producción (2026-08-24)
- CAUSA: los alquileres viven en MongoDB, que NO es compartida entre preview y prod (Ventas/Supabase SÍ es compartida). La migración manual solo tocó preview; en prod seguían los CDE### legacy.
- FIX: `_ensure_codes()` (que ya se llama en GET /rentals/properties) ahora NORMALIZA cualquier código que no cumpla `^A\d+$` (incluye CDE###/vacíos) renombrándolo a A### (A100–A1000) único vía `_next_code()`. Idempotente: tras normalizar no vuelve a tocar. Se dispara al abrir la pantalla de Alquileres.
- Verificado en preview: forzado CDE009 -> al listar quedó A161 (formato/rango OK).
- ACCIÓN USUARIO: redeployar y abrir Alquileres una vez; los CDE### de prod pasan a A### automáticamente.

### Feature: Bot de pre-atención de Alquileres — FASE 1 (motor + simulador) (2026-08-24)
- OBJETIVO: reemplazar "Arturito" (plataforma externa app.arturito.ai, cara por créditos/conversación) con un cerebro NATIVO barato.
- DECISIÓN DE CANAL (corregida): Arturito NO usa QR; usa Embedded Signup oficial de Meta + coexistencia (por eso se integró sin escanear y el celular sigue andando). => El canal será WhatsApp Cloud API oficial con COEXISTENCIA (Fase 3): sin QR, sin riesgo de baneo, y la secretaria sigue cerrando desde el celular (no hace falta bandeja en Vera). Lo caro era el crédito de Arturito, no Meta (servicio gratis en ventana 24h hasta oct-2026).
- FASE 1 (HECHA y verificada): backend `rentals_bot.py` (router /api/rentals/bot). Motor con Gemini Flash (gemini-3-flash-preview) vía Emergent LLM key. Endpoint POST /simulate (memoria por session_id), GET/PUT /faq (FAQ editable, con defaults). `_build_system()` arma el contexto con catálogo real (activas): código, tipo, capacidad, precio/noche, descuentos, mascotas, ropa blanca, check-in/out, estadía mínima, depósito y RANGOS OCUPADOS por propiedad. Persona: asistente de Varela Propiedades, español rioplatense, SOLO pre-atención, no cierra, no inventa, aclara que el equipo confirma. Conversaciones guardadas en `rental_bot_convos`.
- FRONTEND: `RentalBotSimulator.tsx` (ruta /veraos/bot-alquileres, nav "Bot Alquileres" admin-only). Chat de prueba (data-testids: rental-bot-simulator, bot-input, bot-send, bot-msg-user/bot, bot-thread, bot-reset).
- Verificado e2e: el bot pide fechas, detecta ocupación (no ofrece propiedad ocupada) y respeta "no acepta mascotas" con datos reales. tsc OK, backend sin errores.
- PENDIENTE FASE 2: bandeja/estado "en pausa" + resúmenes 2x/día (09:30 turno mañana = resume lo de horario cerrado; 16:30 = resume 13:00–16:30) con clasificación de urgencia; entrega en panel + WhatsApp/mail. Editor de FAQ en la UI.
- PENDIENTE FASE 3: conectar número real (Cloud API + coexistencia via Embedded Signup); soltar de Arturito. Checklist Meta (WABA, phone number ID, token de system user, app secret, verify token, webhook /webhooks/whatsapp).

### Feature: Entrenamiento del Bot de Alquileres (config + reglas + contactos + ventas) (2026-08-24)
- Backend rentals_bot.py ampliado: colecciones rental_bot_config (single doc) y rental_bot_contacts. `_build_system(from_phone)` ahora arma el prompt con: identidad/tono/saludo (config), reglas activas, datos fijos, FAQ, condiciones, catálogo de ALQUILERES real y (si ventasActivo) catálogo de VENTAS real (property_repository.list_properties, excluye alquileres) con derivación a Sebastián; alquileres/admin deriva a Mariana.
- RECONOCIMIENTO DE CONTACTOS: `_known_contact(phone)` matchea por últimos 8 dígitos; si el que escribe es propietario/limpieza/técnico → MODO NO COMERCIAL (no ofrece propiedades, atiende directo y deriva). El simulate acepta fromPhone para probarlo.
- Endpoints: GET/PUT /rentals/bot/config, POST /rentals/bot/rules/seed (reglas sugeridas), POST/DELETE /rentals/bot/contacts, GET/PUT /faq, POST /simulate (con fromPhone).
- Frontend: RentalBotTraining.tsx (ruta /veraos/entrenar-vera, nav "Entrenar Vera") con secciones Identidad&Tono, Ventas&Alquileres (toggles + deriva), Reglas (activar/editar/borrar + Cargar sugeridas), Datos fijos, Contactos conocidos (alta/baja), FAQ. Botón "Entrenar" en el simulador. data-testids: bot-training, cfg-*, regla-*, nc-*, faq-*, save-training.
- Verificado e2e (API + UI): contacto conocido (limpieza) → no ofrece nada, deriva Mariana; consulta ventas → muestra V752/V145/V211 reales y deriva Sebastián; panel guarda config/contactos/faq. tsc OK.
- PENDIENTE: Fase 2 (resúmenes 2x/día 09:30 y 16:30 + urgencia + panel/WhatsApp/mail) y Fase 3 (conectar WhatsApp Cloud API + coexistencia; seguimientos). Requiere REDEPLOY para prod.
