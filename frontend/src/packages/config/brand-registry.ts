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
  | 'mercadopago'
  | 'mercadolibre'
  | 'arturito';

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
  'mercadolibre',
  'arturito',
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

/**
 * Color oficial de cada marca. Se usa para teñir la silueta del logo (máscara)
 * y que se lea nítida sobre el tema oscuro. Sumar una marca = agregar su hex.
 * (calendar/drive/youtube usan su color oficial estándar; ajustable.)
 */
export const BrandColors: Partial<Record<BrandKey, string>> = {
  whatsapp: '#25D366',
  gmail: '#EA4335',
  dropbox: '#0061FF',
  mercadopago: '#00B1EA',
  mercadolibre: '#FFE600',
  instagram: '#FF0069',
  gemini: '#8E75B2',
  openai: '#0081A5',
  claude: '#D97757',
  spotify: '#1ED760',
  meta: '#0467DF',
  calendar: '#4285F4',
  drive: '#4285F4',
  youtube: '#FF0000',
};

/** Devuelve el color oficial de una marca, o undefined si no tiene definido. */
export const brandColor = (key?: string): string | undefined =>
  key && key in BrandColors ? BrandColors[key as BrandKey] : undefined;

