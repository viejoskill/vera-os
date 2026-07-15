# ROADMAP

Estrategia: primero una **fundación sólida**, luego el dominio de negocio sobre esa base,
fortaleciendo Services más que agregando pantallas.

## ✅ Sprint 0A — Foundation (v0.1, aprobado)

Monorepo lógico, TypeScript strict, Design System único, UI Kit base, Repository + Provider
Pattern, shell (Sidebar/TopBar/routing/responsive) y vertical slice de Propiedades (mock).

## ✅ Sprint 0A.1 — Cleanup (aprobado)

Eliminado boilerplate del template (shadcn, hooks/lib/constants), proyecto 100% TypeScript,
tokens consolidados (cero colores hardcodeados), backend limpio (`/api/health`).

## 🔒 Foundation v0.1

Freeze en GitHub como baseline estable antes del dominio de negocio.

## ▶️ Sprint 0B — Dominio de negocio (próximo)

Construir el dominio de VERA sobre la base estable. Candidatos:

- **App Hoy** — dashboard AI-first con el resumen del día y accesos rápidos.
- **Detalle de Propiedad** — ficha completa + galería (extraer `PropertyCard`).
- **Persistencia real** — `SupabasePropertyRepository` detrás de la interfaz existente.
- Ampliar UI Kit según necesidad (Modal, Badge, Tabs, Panel, Timeline, FAB).

## Backlog priorizado

**P1**
- Backend real + repositorios Supabase/PostgreSQL (swap detrás de interfaces).
- App `Operaciones` (pipeline comercial) + `OperationService` + `InsightService`.

**P2**
- App `Studio` (contenido y distribución: Mercado Libre, Meta, Google, WhatsApp).
- AIProvider real (OpenAI/Anthropic/Gemini) vía Provider Pattern.
- Auth + RBAC (roles ya modelados en `@vera/types`).
- Implementación de `EventBus` (contratos ya definidos en `@vera/events`).

**Futuro**
- Portales (Propietario/Comprador/Inversor), automatizaciones, tasaciones, lead scoring,
  analytics, documentos y firmas digitales — sin reescribir la arquitectura.
