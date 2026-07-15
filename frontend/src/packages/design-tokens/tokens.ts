/**
 * VERA Design Tokens — THE single source of truth for the visual language.
 * No component may hardcode a color, spacing or font value: everything comes from here.
 * Values are defined once (TypeScript) and projected to CSS custom properties.
 */

export const color = {
  primary: '#F6E63A',
  /** Foreground used on top of `primary` (reuses background for AA contrast on yellow). */
  primaryForeground: '#1C1C1C',
  background: '#1C1C1C',
  surface: '#252525',
  card: '#2E2E2E',
  border: '#3A3A3A',
  text: '#FFFFFF',
  textSecondary: '#B9B9B9',
  /** Semantic + derived tokens — the single source for these values (no CSS literals). */
  danger: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.5)',
  glass: 'rgba(28, 28, 28, 0.72)',
  focusRing: 'rgba(246, 230, 58, 0.15)',
} as const;

/** 8px grid with a 4px baseline half-step. */
export const space = {
  none: '0px',
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  pill: '999px',
} as const;

export const font = {
  family: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  size: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '20px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '40px',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
    normal: '1.5',
  },
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.30)',
  md: '0 8px 24px rgba(0, 0, 0, 0.35)',
} as const;

export const zIndex = {
  base: '0',
  sidebar: '30',
  topbar: '20',
  overlay: '40',
  modal: '50',
} as const;

export const tokens = { color, space, radius, font, shadow, zIndex } as const;

export type Tokens = typeof tokens;
