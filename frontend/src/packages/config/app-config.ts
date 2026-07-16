/** Global, static application configuration. */

export const appConfig = {
  name: 'VERA',
  productName: 'VERA OS',
  tagline: 'Sistema Operativo Comercial',
  locale: 'es-AR',
  defaultCurrency: 'USD',
} as const;

export type AppConfig = typeof appConfig;
