import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { env } from '@vera/config';

interface Listing { id: string; title: string; neighborhood: string; city: string; type: string; operation: string; code: string; }

const STOP = new Set(['venta', 'alquiler', 'ficha', 'propiedad', 'con', 'los', 'las', 'del', 'para', 'por', 'una', 'costa', 'este']);

/** Normaliza a tokens comparables: minúsculas, sin acentos, sin números, len>=4. */
const tokens = (s: string): string[] =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !STOP.has(t));

/**
 * Compatibilidad SEO: las URLs viejas `/ficha/{id}-{slug}` siguen indexadas en Google.
 * El id numérico viejo NO existe en la base actual (se perdió en la migración), así que
 * NO se puede resolver 1:1. En su lugar matcheamos el TEXTO del slug contra la cartera
 * en vivo y redirigimos a la ficha más parecida; si no hay match confiable, a la Cartera.
 * Es un redirect client-side (no 301 real) pero elimina el soft-404 y conserva el link juice.
 */
export const LegacyFichaRedirect = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const goCartera = () => !cancelled && navigate('/web', { replace: true });
      // Quita el id numérico inicial (`9847-...`) y tokeniza el resto.
      const slugTokens = tokens(slug.replace(/^\d+-?/, ''));
      if (slugTokens.length === 0) return goCartera();
      try {
        const res = await fetch(`${env.backendUrl}/api/public/listings`);
        if (!res.ok) return goCartera();
        const listings: Listing[] = await res.json();
        let best: { id: string; score: number } | null = null;
        for (const l of listings) {
          const hay = new Set(tokens(`${l.title} ${l.neighborhood} ${l.city} ${l.type} ${l.operation} ${l.code}`));
          let score = 0;
          for (const t of slugTokens) if (hay.has(t)) score += 1;
          if (!best || score > best.score) best = { id: l.id, score };
        }
        // Confianza: al menos 2 tokens significativos y >=40% del slug.
        const ratio = best ? best.score / slugTokens.length : 0;
        if (best && best.score >= 2 && ratio >= 0.4) {
          !cancelled && navigate(`/web/${best.id}`, { replace: true });
        } else {
          goCartera();
        }
      } catch {
        goCartera();
      }
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  return (
    <div className="vera-pub" data-testid="legacy-ficha-redirect">
      <p className="vera-pub__empty">Redirigiendo…</p>
    </div>
  );
};

export default LegacyFichaRedirect;
