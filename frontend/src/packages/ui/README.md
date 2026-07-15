# @vera/ui

The **VERA UI Kit** — the only place UI components are defined. Apps never invent components.

## Purpose

A small, consistent, accessible set of reusable primitives, styled exclusively from
`@vera/design-tokens` (no hardcoded colors/spacing/typography).

## Components (Sprint 0A)

- `Button` — variants `primary | secondary | ghost`, sizes `sm | md`.
- `Card` — base surface, optional `interactive`.
- `Input` — labelled, `aria`-wired, error state.
- `Sidebar` — presentational navigation (routing stays in the App).
- `TopBar` — contextual header with actions slot.

All components are reusable, responsive, accessible, fully typed and decoupled from
routing/business logic.

## Dependencies

- `react`, `@vera/design-tokens` (via CSS variables consumed in `ui.css`)

## Extension points

- Add new primitives (Modal, Toast, Badge, Tabs, Panel, Timeline, FAB) here only.
- Never create one-off variants inside Apps.
