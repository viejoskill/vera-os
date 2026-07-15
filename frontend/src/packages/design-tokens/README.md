# @vera/design-tokens

The **single source of truth** for VERA's visual language.

## Purpose

Defines every design primitive (colors, spacing, radius, typography, shadows, z-index)
**once**, in TypeScript. No component is allowed to hardcode a visual value.

## Responsibilities

- Expose typed token objects (`color`, `space`, `radius`, `font`, `shadow`, `zIndex`).
- Project those tokens to CSS custom properties (`--vera-*`) via `injectDesignTokens()`.

## Dependencies

None. This package sits at the bottom of the dependency graph.

## Extension points

- Add semantic aliases (e.g. `color.success`) here and they flow everywhere automatically.
- Add a light theme by exporting an alternate token set and swapping the injected `:root` block.

## Usage

```ts
import { tokens, injectDesignTokens } from '@vera/design-tokens';

injectDesignTokens(); // once, at bootstrap
element.style.color = tokens.color.primary; // or CSS: var(--vera-color-primary)
```
