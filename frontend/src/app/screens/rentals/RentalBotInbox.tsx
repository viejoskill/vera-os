import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, Inbox, MessageCircle } from 'lucide-react';
import { env } from '@vera/config';

const API = `${env.backendUrl}/api/rentals/bot`;

interface Item { sessionId: string; urgencia: string; resumen: string; accion?: string; ultimoMensaje?: string }
interface Digest { label: string; generadoAt: string; counts: Record<string, number>; total: number; items: Item[] }

const DOT: Record<string, { c: string; l: string }> = {
  roja: { c: '#e05a5a', l: 'Urgente' },
  amarilla: { c: '#F6E63A', l: 'Seguir' },
  verde: { c: '#8fe3c4', l: 'Resuelto' },
};

export const RentalBotInbox = () => {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const d = await fetch(`${API}/digests?limit=1`).then((r) => r.json());
    setDigest(d.digests?.[0] || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generar = async () => {
    setGen(true);
    const d = await fetch(`${API}/digest/generate`, { method: 'POST' }).then((r) => r.json());
    setDigest(d); setDone({}); setGen(false);
  };

  const resolver = async (sid: string) => {
    await fetch(`${API}/conversations/${sid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'resuelto' }) });
    setDone((s) => ({ ...s, [sid]: true }));
  };

  const c = digest?.counts || { roja: 0, amarilla: 0, verde: 0 };

  return (
    <div data-testid="bot-inbox" style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 16, fontWeight: 700 }}>
            <Inbox size={18} /> Bandeja del bot — resúmenes por turno
          </div>
          <p style={{ margin: '2px 0 0', color: '#9a9a95', fontSize: 12.5 }}>{digest ? digest.label : 'Todavía no hay resúmenes generados'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {(['roja', 'amarilla', 'verde'] as const).map((k) => (
            <span key={k} data-testid={`count-${k}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, color: '#ddd' }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: DOT[k].c }} /> {c[k] || 0}
            </span>
          ))}
          <button onClick={generar} disabled={gen} data-testid="generate-digest" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 10, background: '#8fe3c4', color: '#0f2a22', border: 'none', fontWeight: 700, cursor: gen ? 'default' : 'pointer', opacity: gen ? 0.6 : 1, fontSize: 13 }}>
            <RefreshCw size={14} /> {gen ? 'Generando…' : 'Generar ahora'}
          </button>
        </div>
      </div>

      {loading && <p style={{ color: '#9a9a95', fontSize: 13 }}>Cargando…</p>}
      {!loading && (!digest || digest.items.length === 0) && (
        <div style={{ padding: 28, textAlign: 'center', color: '#6b6b66', background: '#141412', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 14, fontSize: 13 }}>
          No hay conversaciones en este período. Tocá <strong>“Generar ahora”</strong> para armar el resumen del turno.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {digest?.items.map((it) => {
          const d = DOT[it.urgencia] || DOT.amarilla;
          const resolved = done[it.sessionId];
          return (
            <div key={it.sessionId} data-testid={`inbox-item-${it.urgencia}`} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${d.c}`, borderRadius: 12, opacity: resolved ? 0.5 : 1 }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: d.c, marginTop: 5, flexShrink: 0 }} title={d.l} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: d.c, textTransform: 'uppercase' }}>{d.l}</span>
                  <span style={{ fontSize: 11, color: '#77776f' }}>· {it.sessionId}</span>
                </div>
                <div style={{ color: '#f1f1ec', fontSize: 13.5, marginTop: 3, lineHeight: 1.4 }}>{it.resumen}</div>
                {it.accion && <div style={{ color: '#9a9a95', fontSize: 12, marginTop: 3 }}>👉 {it.accion}</div>}
                {it.ultimoMensaje && <div style={{ color: '#6b6b66', fontSize: 12, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{it.ultimoMensaje}”</div>}
              </div>
              <button onClick={() => resolver(it.sessionId)} disabled={resolved} data-testid={`resolve-${it.sessionId}`} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, background: 'rgba(143,227,196,0.1)', color: '#8fe3c4', border: '1px solid rgba(143,227,196,0.25)', cursor: resolved ? 'default' : 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={13} /> {resolved ? 'Resuelto' : 'Marcar resuelto'}
              </button>
              {/^\d{8,15}$/.test(it.sessionId) && (
                <a
                  href={`https://wa.me/${it.sessionId}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`open-wa-${it.sessionId}`}
                  title="Abrir el chat en WhatsApp"
                  style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, background: 'rgba(37,211,102,0.12)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', textDecoration: 'none', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  <MessageCircle size={13} /> Abrir en WhatsApp
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RentalBotInbox;
