/**
 * Projects the TypeScript tokens into CSS custom properties (`--vera-*`).
 * The TS object remains the single source of truth; this only mirrors it to CSS
 * so components can use hover/focus/media-query states without duplicating values.
 */
import { tokens } from './tokens';

function flatten(prefix: string, obj: Record<string, unknown>, out: Record<string, string>): void {
  for (const [key, value] of Object.entries(obj)) {
    const name = `${prefix}-${key}`.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    if (value && typeof value === 'object') {
      flatten(name, value as Record<string, unknown>, out);
    } else {
      out[name] = String(value);
    }
  }
}

export function buildCssVariables(): Record<string, string> {
  const out: Record<string, string> = {};
  flatten('--vera', tokens as unknown as Record<string, unknown>, out);
  return out;
}

export function cssVariablesString(): string {
  const vars = buildCssVariables();
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
}

const STYLE_ID = 'vera-design-tokens';

/** Injects the token variables into <head>. Call once at app bootstrap. */
export function injectDesignTokens(): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `:root {\n${cssVariablesString()}\n}`;
}
