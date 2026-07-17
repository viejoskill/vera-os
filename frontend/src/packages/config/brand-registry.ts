/**
 * BrandRegistry — resolución CENTRALIZADA de logos de marcas/integraciones.
 * Los assets viven en `/public/brands/{key}.png` (nombres estandarizados, sin
 * prefijos como `googlecalendar`). Sumar una marca = agregar su clave acá y su PNG.
 * Mientras el PNG no exista, `BrandIcon` cae al ícono vectorial de fallback.
 */
export type BrandKey =
  | 'gmail'
  | 'whatsapp'
  | 'spotify'
  | 'calendar'
  | 'drive'
  | 'dropbox'
  | 'instagram'
  | 'facebook'
  | 'meta'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'notion'
  | 'slack'
  | 'trello'
  | 'canva'
  | 'canvas'
  | 'mercadopago';

const BRAND_KEYS: BrandKey[] = [
  'gmail',
  'whatsapp',
  'spotify',
  'calendar',
  'drive',
  'dropbox',
  'instagram',
  'facebook',
  'meta',
  'linkedin',
  'youtube',
  'tiktok',
  'openai',
  'claude',
  'gemini',
  'notion',
  'slack',
  'trello',
  'canva',
  'canvas',
  'mercadopago',
];

const BASE = `${process.env.PUBLIC_URL ?? ''}/brands`;

export const BrandRegistry: Record<BrandKey, string> = BRAND_KEYS.reduce(
  (acc, key) => {
    acc[key] = `${BASE}/${key}.png`;
    return acc;
  },
  {} as Record<BrandKey, string>,
);

/** Devuelve la URL del logo de una marca, o undefined si no está registrada. */
export const brandSrc = (key?: string): string | undefined =>
  key && key in BrandRegistry ? BrandRegistry[key as BrandKey] : undefined;
