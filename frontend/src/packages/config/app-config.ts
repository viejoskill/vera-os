/** Global, static application configuration. */

export const appConfig = {
  name: 'VERA',
  productName: 'VERA OS',
  tagline: 'Real Estate Operating System',
  locale: 'es-AR',
  defaultCurrency: 'USD',
} as const;

export type AppConfig = typeof appConfig;
