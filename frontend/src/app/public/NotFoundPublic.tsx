import { Link } from 'react-router-dom';
import { usePageMeta, SITE_URL } from './usePageMeta';

const wrap: React.CSSProperties = {
  background: '#0A0A0B', color: '#fff', minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center',
};
const box: React.CSSProperties = { maxWidth: 420 };
const eyebrow: React.CSSProperties = { color: '#F6E63A', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.2em' };
const h1: React.CSSProperties = { fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', margin: '12px 0 10px' };
const p: React.CSSProperties = { color: '#b4b4b8', lineHeight: 1.6, marginBottom: 28 };
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F6E63A', color: '#0A0A0B',
  fontWeight: 700, borderRadius: 999, padding: '13px 26px', textDecoration: 'none', fontSize: '0.95rem',
};

/** Página real para rutas públicas inexistentes. Nota: por una limitación del hosting
 *  estático de la plataforma, esta página no puede devolver un status HTTP 404 real (todas
 *  las rutas no-/api sirven el mismo index.html con 200) — por eso se marca `noindex` para
 *  que no quede indexada igual, y ya no redirige en silencio a la home. */
export const NotFoundPublic = () => {
  usePageMeta({
    title: 'Página no encontrada · Varela Propiedades',
    description: 'Esta página no existe o fue movida.',
    canonical: `${SITE_URL}${typeof window !== 'undefined' ? window.location.pathname : ''}`,
    noindex: true,
  });
  return (
    <div style={wrap} data-testid="public-not-found">
      <div style={box}>
        <span style={eyebrow}>Error 404</span>
        <h1 style={h1}>No encontramos esta página</h1>
        <p style={p}>El enlace puede estar roto o la página fue movida. Volvé al inicio para seguir buscando.</p>
        <Link to="/" style={btn} data-testid="public-not-found-home">Ir al inicio</Link>
      </div>
    </div>
  );
};

export default NotFoundPublic;
