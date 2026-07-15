# FOUNDATION (Sprint 0A · v0.1)

Base técnica de VERA OS: desacoplada, portable y mantenible. Arquitectura independiente de
la infraestructura del entorno.

## Monorepo lógico

Implementado dentro de `frontend/src` con aliases `@vera/*` y fronteras estrictas.
Promoción a monorepo físico (pnpm/Turborepo) = mover carpetas + agregar `package.json`,
**sin reescribir lógica**.

```
app/                 apps/vera-os (Shell, routing, screens, hooks)
packages/
  design-tokens/     tokens en TS → CSS variables (única fuente de verdad)
  ui/                VERA UI Kit: Button, Card, Input, Sidebar, TopBar
  types/             Property, User, Role, Permission
  config/            env, appConfig, featureFlags
  events/            DomainEvent + EventBus (solo contratos)
  repositories/      Repository Pattern + InMemoryPropertyRepository (mock)
  services/          PropertyService, AIService + AIProvider, composition root
```

## Dirección de dependencias (una sola vía)

```
app → services → repositories → types
 └→ ui → design-tokens        (config, events = hojas)
```

Las Apps nunca tocan la persistencia; los Services nunca tocan la UI.

## Patrones clave

- **Repository Pattern** — persistencia detrás de interfaces; swap a Supabase/PostgreSQL sin tocar Apps.
- **Provider Pattern (IA)** — `AIProvider` abstrae el LLM; hoy `MockAIProvider`, mañana OpenAI/Anthropic/Gemini cambiando **una línea**.
- **Composition Root** — `services/service-container.ts`: único lugar que cablea implementaciones concretas.
- **Feature-flag-driven navigation** — activar una App = flip de flag en `@vera/config`.
- **Design Tokens** — cada valor visual definido una sola vez; cero colores hardcodeados.

## Calidad y estándares

- **TypeScript strict** (`tsc --noEmit` limpio), sin `.js/.jsx` en `src`.
- ESLint (flat, estándar), Prettier, Husky + lint-staged (se activan en Git/Cursor/VS Code).
- Backend FastAPI con estructura VERA preservada; solo expone `GET /api/health` en esta etapa.

## Vertical slice validado

`Propiedades`: UI (UI Kit) → hook → PropertyService → Repository → datos mock, con filtros,
búsqueda y briefing de VERA AI (mock). Testeado: frontend 100%, backend 100%.

## Restricciones actuales (por diseño)

Sin base de datos real, sin auth, sin integraciones externas, sin IA real. Todo mock,
preparado para evolucionar.
