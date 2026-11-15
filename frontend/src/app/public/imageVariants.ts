/** Copias WebP livianas (480/960/1600px) de las fotos de propiedades, listas para
 * <img srcSet>. Vienen del backend solo cuando la propiedad está publicada en la
 * web y ya se generaron (ver public_photos.py); si no, es `undefined`/`{}` y el
 * <img> cae a su `src` normal (el original firmado, sin este ahorro). */
export const buildSrcSet = (variants?: Record<string, string>): string | undefined => {
  if (!variants) return undefined;
  const entries = Object.entries(variants);
  if (!entries.length) return undefined;
  return entries.map(([w, url]) => `${url} ${w}w`).join(', ');
};

/** La variante más chica (480px) para thumbnails fijos y popups pequeños, donde no
 * hace falta srcset — alcanza con pedir directamente el archivo liviano. */
export const smallVariant = (variants?: Record<string, string>, fallback = ''): string =>
  variants?.['480'] || fallback;
