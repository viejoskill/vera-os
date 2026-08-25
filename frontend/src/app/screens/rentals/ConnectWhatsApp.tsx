import { useEffect, useRef, useState } from 'react';
import { MessageCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { env } from '@vera/config';

const API = `${env.backendUrl}/api/integrations/whatsapp`;

interface Conn {
  phoneNumberId: string; wabaId: string; displayPhone?: string;
  verifiedName?: string; isOnBizApp?: boolean; platformType?: string; status?: string;
}

const box: React.CSSProperties = { background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 16 };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 };

declare global {
  interface Window { FB?: any; fbAsyncInit?: () => void; __waCode?: string }
}

export const ConnectWhatsApp = () => {
  const [cfg, setCfg] = useState<{ appId: string; configId: string; graphVersion: string } | null>(null);
  const [conns, setConns] = useState<Conn[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  const loadStatus = async () => {
    try { const d = await fetch(`${API}/status`).then((r) => r.json()); setConns(d.connections || []); } catch { /* noop */ }
  };

  useEffect(() => {
    fetch(`${API}/config`).then((r) => r.json()).then(setCfg).catch(() => setCfg(null));
    loadStatus();
  }, []);

  // Cargar el SDK de Facebook una vez que tenemos el appId.
  useEffect(() => {
    if (!cfg?.appId) return;
    window.fbAsyncInit = function () {
      window.FB.init({ appId: cfg.appId, cookie: true, xfbml: false, version: cfg.graphVersion || 'v21.0' });
      setSdkReady(true);
    };
    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script');
      s.id = 'facebook-jssdk'; s.async = true; s.defer = true;
      s.src = 'https://connect.facebook.net/es_LA/sdk.js';
      document.body.appendChild(s);
    } else if (window.FB) { setSdkReady(true); }
  }, [cfg?.appId, cfg?.graphVersion]);

  // Escuchar el evento del Embedded Signup (trae waba_id + phone_number_id).
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !event.origin.includes('facebook.com')) return;
      let data: any;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (data.event === 'CANCEL' || data.event === 'ERROR') {
        setError('Conexión cancelada o con error en Meta. Probá de nuevo.'); setBusy(false); return;
      }
      const s = data.data || {};
      sessionRef.current = { waba_id: s.waba_id, phone_number_id: s.phone_number_id };
      await tryFinish();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryFinish = async () => {
    const code = window.__waCode;
    const { waba_id, phone_number_id } = sessionRef.current;
    if (!code || !waba_id || !phone_number_id) return; // esperamos a tener las 2 piezas
    window.__waCode = undefined;
    setStatus('Finalizando conexión…');
    try {
      const r = await fetch(`${API}/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, waba_id, phone_number_id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || 'No se pudo conectar');
      setStatus('✅ ¡WhatsApp conectado! Ya podés recibir y responder desde tu número.');
      await loadStatus();
    } catch (e: any) {
      setError(e.message || 'No se pudo completar la conexión.');
    } finally { setBusy(false); sessionRef.current = {}; }
  };

  const connect = () => {
    setError(''); setStatus('Abriendo Meta…'); setBusy(true); sessionRef.current = {};
    window.FB.login((resp: any) => {
      if (resp?.authResponse?.code) { window.__waCode = resp.authResponse.code; tryFinish(); }
      else { setError('No se autorizó la conexión.'); setBusy(false); }
    }, {
      config_id: cfg?.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
    });
  };

  const configMissing = !cfg?.configId;

  return (
    <div style={box} data-testid="wa-connect">
      <div style={h2}><MessageCircle size={18} color="#25D366" /> Conectar mi WhatsApp de Alquileres</div>
      <p style={{ margin: '2px 0 12px', color: '#9a9a95', fontSize: 12.5 }}>
        Conectá tu número real por <b>coexistencia</b>: la secretaria sigue usando WhatsApp en el celular y VERA atiende en paralelo. Todo queda en la Bandeja.
      </p>

      {conns.length > 0 ? (
        <div>
          {conns.map((c) => (
            <div key={c.phoneNumberId} data-testid="wa-connected" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(143,227,196,0.08)', border: '1px solid rgba(143,227,196,0.25)', marginBottom: 8 }}>
              <CheckCircle2 size={18} color="#8fe3c4" />
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{c.verifiedName || 'WhatsApp'} · {c.displayPhone || c.phoneNumberId}</div>
                <div style={{ color: '#9a9a95', fontSize: 12 }}>
                  Conectado {c.isOnBizApp ? '· coexistencia con la app del celular' : ''} {c.platformType ? `· ${c.platformType}` : ''}
                </div>
              </div>
            </div>
          ))}
          <p style={{ color: '#9a9a95', fontSize: 12, marginTop: 8 }}>¿Querés conectar otro número? Tocá el botón de abajo.</p>
        </div>
      ) : null}

      {configMissing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(246,230,58,0.07)', border: '1px solid rgba(246,230,58,0.25)', color: '#e9e4b0', fontSize: 12.5 }}>
          <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Falta el paso de configuración en Meta (Configuration ID). En cuanto lo cargues, este botón queda activo.</span>
        </div>
      ) : (
        <button
          type="button"
          data-testid="wa-connect-btn"
          onClick={connect}
          disabled={!sdkReady || busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: 'none', background: '#25D366', color: '#0b3d24', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: !sdkReady || busy ? 0.6 : 1 }}
        >
          {busy ? <Loader2 size={16} className="spin" /> : <MessageCircle size={16} />}
          {conns.length > 0 ? 'Conectar otro número' : 'Conectar mi WhatsApp'}
        </button>
      )}

      {status && <p data-testid="wa-status" style={{ color: '#8fe3c4', fontSize: 12.5, marginTop: 10 }}>{status}</p>}
      {error && <p data-testid="wa-error" style={{ color: '#e05a5a', fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
};
