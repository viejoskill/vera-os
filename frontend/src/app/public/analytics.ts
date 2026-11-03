import { env } from '@vera/config';

const VISITOR_KEY = 'vera_visitor_id';
const AD_SESSION_KEY = 'vera_from_ad';

/** Id anónimo persistido en este navegador, solo para contar visitantes únicos
 * (no identifica a la persona, no se cruza con ningún dato personal). */
const getVisitorId = (): string => {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};

/** Si la URL trae `gclid` (quien entró hizo clic en un anuncio de Google), lo
 * recordamos para el resto de esta sesión del navegador, para que todas las
 * páginas que recorra cuenten como "visita desde un anuncio", no solo la primera. */
const isFromAd = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('gclid')) sessionStorage.setItem(AD_SESSION_KEY, '1');
  return sessionStorage.getItem(AD_SESSION_KEY) === '1';
};

/** Registro best-effort de una vista de página pública (Ventas o Alquileres).
 * Nunca bloquea ni rompe la pantalla si falla. */
export const trackPageView = (
  section: 'ventas' | 'alquileres',
  extra?: { propertyId?: string; propertyCode?: string },
) => {
  try {
    fetch(`${env.backendUrl}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        visitorId: getVisitorId(),
        section,
        propertyId: extra?.propertyId || null,
        propertyCode: extra?.propertyCode || null,
        fromAd: isFromAd(),
        referrer: document.referrer || '',
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* no-op: el tracking es best-effort, nunca debe afectar la navegación */
  }
};
