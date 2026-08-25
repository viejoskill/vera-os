import { useEffect, useState } from 'react';
import { Inbox, ArrowRight, MessageCircle } from 'lucide-react';
import { env } from '@vera/config';

const API = `${env.backendUrl}/api/rentals/bot`;

interface Item { sessionId: string; urgencia: string; resumen: string; accion?: string }
interface Digest { label: string; counts: Record<string, number>; total: number; items: Item[] }

const DOT: Record<string, { c: string; l: string }> = {
  roja: { c: '#e05a5a', l: 'Urgente' },
  amarilla: { c: '#F6E63A', l: 'Seguir' },
  verde: { c: '#8fe3c4', l: 'Resuelto' },
};

const card: React.CSSProperties = {
  background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16,
};

export const DigestSummaryCard = ({ onVerBandeja }: { onVerBandeja?: () => void }) => {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/digests?limit=1`)
      .then((r) => r.json())
      .then((d) => setDigest(d.digests?.[0] || null))
      .catch(() => setDigest(null))
      .finally(() => setLoading(false));
  }, []);

  const c = digest?.counts || { roja: 0, amarilla: 0, verde: 0 };
  const orden: Record<string, number> = { roja: 0, amarilla: 1, verde: 2 };
  const top = [...(digest?.items || [])]
    .sort((a, b) => (orden[a.urgencia] ?? 1) - (orden[b.urgencia] ?? 1))
    .slice(0, 3);

  return (
    <div style={card} data-testid="digest-summary-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#fff', fontSize: 14, fontWeight: 700 }}>
          <Inbox size={16} /> Bandeja del bot
        </span>
        {onVerBandeja && (
          <button
            type="button"
            onClick={onVerBandeja}
            data-testid="digest-summary-ver"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: '#8fe3c4', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Ver bandeja <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: top.length ? 12 : 0 }}>
        {(['roja', 'amarilla', 'verde'] as const).map((k) => (
          <span key={k} data-testid={`digest-count-${k}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, color: '#ddd' }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: DOT[k].c }} /> {c[k] || 0}
          </span>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#9a9a95', fontSize: 12.5, margin: 0 }}>Cargando…</p>
      ) : top.length === 0 ? (
        <p style={{ color: '#6b6b66', fontSize: 12.5, margin: 0 }}>Sin consultas pendientes en el último resumen.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {top.map((it) => {
            const d = DOT[it.urgencia] || DOT.amarilla;
            const isPhone = /^\d{8,15}$/.test(it.sessionId);
            return (
              <div key={it.sessionId} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', paddingLeft: 2 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: d.c, marginTop: 5, flexShrink: 0 }} title={d.l} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e9e9e4', fontSize: 12.5, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{it.resumen}</div>
                </div>
                {isPhone && (
                  <a
                    href={`https://wa.me/${it.sessionId}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir en WhatsApp"
                    style={{ color: '#25D366', flexShrink: 0, marginTop: 1 }}
                  >
                    <MessageCircle size={15} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
