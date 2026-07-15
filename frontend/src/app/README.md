# apps/vera-os

The runnable VERA OS application (the "app" of the logical monorepo).

## Purpose

Composes the platform: routing, layout shell and screens. **Apps show; Services think.**
This layer contains no business logic — it consumes `@vera/services` (which use
`@vera/repositories` for data and AI Providers for intelligence).

## Structure

- `VeraOS.tsx` — root: providers (React Query) + router.
- `layout/AppLayout.tsx` — Sidebar + TopBar + responsive content (uses `@vera/ui`).
- `navigation.ts` — nav config derived from `@vera/config` feature flags.
- `screens/` — one screen per route. `PropertiesScreen` is the Sprint 0A vertical slice.
- `hooks/` — thin React bindings over Services (`useProperties`, `useDailyBriefing`).

## Dependencies

- `@vera/ui`, `@vera/services`, `@vera/config`, `@vera/types`

## Extension points

- New App = new screen + a feature flag flip + a route. No changes to Services required.
