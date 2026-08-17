import { useCallback, useEffect, useState } from 'react';
import { Store, Loader2, ExternalLink, Plug, RotateCcw } from 'lucide-react';
import { Button } from '@vera/ui';
import { env } from '@vera/config';

const ML = `${env.backendUrl}/api/ml`;

interface MlState { hasListing: boolean; status?: string | null; label?: string; tone?: string; activating?: boolean; url?: string; }

/** Publicación del alquiler en Mercado Libre (como "Alquiler temporal").
 * Reutiliza la conexión OAuth global de ML; publicar/estado/finalizar por propiedad. */
export const MlRentalPublish = ({ propertyId }: { propertyId: string }) => {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [state, setState] = useState<MlState>({ hasListing: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadStatus = useCallback(async () => {
    const s = await fetch(`${ML}/status`).then((r) => r.json());
    setConnected(!!s.connected);
  }, []);
  const loadState = useCallback(async () => {
    const s = await fetch(`${ML}/rentals/${propertyId}/state`).then((r) => r.json());
    setState(s);
  }, [propertyId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (connected) loadState(); }, [connected, loadState]);

  const connect = async () => {
    const { auth_url } = await fetch(`${ML}/oauth/start?origin=${encodeURIComponent(window.location.origin)}`).then((r) => r.json());
    window.location.href = auth_url;
  };

  const publish = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${ML}/rentals/${propertyId}/publish`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || 'Mercado Libre rechazó la publicación');
      await loadState();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error de Mercado Libre'); }
    finally { setBusy(false); }
  };

  const close = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${ML}/rentals/${propertyId}/close`, { method: 'POST' });
      if (!r.ok) { const d = await r.json(); throw new Error(d?.detail || 'No se pudo finalizar'); }
      await loadState();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error de Mercado Libre'); }
    finally { setBusy(false); }
  };

  const published = state.hasListing && state.status !== 'closed' && state.status !== 'inactive';

  return (
    <div className="rt-ml" data-testid="rt-ml">
      <h3 className="rt-ws__sec"><Store size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Mercado Libre</h3>
      {connected === null ? (
        <p className="rt-hint"><Loader2 size={13} className="vera-spin" /> Cargando…</p>
      ) : !connected ? (
        <>
          <p className="rt-hint">Conectá la cuenta de Mercado Libre para publicar tus alquileres como "Alquiler temporal".</p>
          <Button type="button" variant="primary" size="sm" data-testid="rt-ml-connect" onClick={connect}><Plug size={14} /> Conectar Mercado Libre</Button>
        </>
      ) : (
        <>
          <p className="rt-ml__status" data-testid="rt-ml-status">
            {busy ? (<><Loader2 size={13} className="vera-spin" /> Sincronizando…</>)
              : state.hasListing ? (<>
                  {state.activating ? <Loader2 size={13} className="vera-spin" /> : <span className={`vera-dot vera-dot--${state.tone || 'none'}`} />}
                  {state.label || '—'}
                </>)
              : 'Sin publicar en Mercado Libre'}
          </p>
          {published && state.url && (
            <a className="rt-ml__link" href={state.url} target="_blank" rel="noreferrer" data-testid="rt-ml-link"><ExternalLink size={12} /> Ver aviso</a>
          )}
          <div className="rt-ml__actions">
            {published ? (
              <>
                <Button type="button" variant="ghost" size="sm" disabled={busy} data-testid="rt-ml-update" onClick={publish}><RotateCcw size={14} /> Actualizar</Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy} data-testid="rt-ml-close" onClick={close}>Finalizar</Button>
              </>
            ) : (
              <Button type="button" variant="primary" size="sm" disabled={busy} data-testid="rt-ml-publish" onClick={publish}>Publicar en Mercado Libre</Button>
            )}
          </div>
          {err && <p className="rt-ml__err" data-testid="rt-ml-error">{err}</p>}
          <p className="rt-hint">Necesita al menos una foto y el precio por noche cargado. El tipo de inmueble se toma del selector de arriba.</p>
        </>
      )}
    </div>
  );
};
