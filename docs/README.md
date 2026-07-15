# VERA OS

> **VERA is not a CRM. VERA is a Real Estate Operating System.**
> Tan simple como Notion, tan rápido como Linear, tan limpio como Arc.

Sistema operativo inmobiliario moderno, modular y **AI-first**. El usuario no siente que
usa un CRM: siente que opera su inmobiliaria desde un único lugar.

**Versión actual:** `Foundation v0.1` — Sprint 0A completo y aprobado.

## Principios

- **Apps muestran · Services piensan · Repositories aíslan la persistencia · Providers abstraen integraciones · Design Tokens garantizan consistencia.**
- Las Apps nunca se comunican entre sí: todo pasa por Services.
- VERA no evoluciona agregando pantallas, sino fortaleciendo sus Services.

## Estado

- Monorepo **lógico** dentro de `frontend/src` con aliases `@vera/*` (promoción a monorepo
  físico pnpm/Turbo = movimiento mecánico, sin reescribir lógica).
- **TypeScript strict**, un único Design System, tooling profesional (ESLint, Prettier, Husky).
- Una pantalla funcional (`Propiedades`) que valida toda la arquitectura de punta a punta con datos mock.

## Estructura

```
frontend/src/
  app/                 apps/vera-os (Shell + routing + screens)
  packages/
    design-tokens/     única fuente de verdad visual
    ui/                VERA UI Kit (Button, Card, Input, Sidebar, TopBar)
    types/ config/ events/ repositories/ services/
backend/               FastAPI (solo /api/health en esta etapa)
docs/                  este directorio
```

## Documentos

- [`VISION.md`](./VISION.md) — qué es VERA y hacia dónde va.
- [`FOUNDATION.md`](./FOUNDATION.md) — arquitectura y decisiones técnicas de la base.
- [`ROADMAP.md`](./ROADMAP.md) — sprints y backlog priorizado.

## Cómo correr (frontend)

```bash
cd frontend
yarn start       # dev server
yarn typecheck   # tsc --noEmit (strict)
yarn lint        # eslint
```
