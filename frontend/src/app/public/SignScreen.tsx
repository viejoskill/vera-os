import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Download, PenLine, ShieldCheck, X } from 'lucide-react';
import { env } from '@vera/config';

interface SignView {
  token: string;
  expired: boolean;
  alreadySigned: boolean;
  rejected?: boolean;
  document: { id: string; title: string; category: string; signatureMethod?: string | null; body?: unknown; resolvedVariables: Record<string, unknown> };
  participant: {
    id: string; name?: string | null; role?: string | null; status: string;
    signatureMethod?: string | null; signedAt?: string | null;
    signatureData?: { hash?: string; typedName?: string; image?: string; method?: string; mode?: string } | null;
  };
}

const API = `${env.backendUrl}/api/sign`;

/** Pantalla pública de firma (`/firma/:token`) — sin login. El firmante abre el
 * enlace en su celular, ve el documento y firma (digital o presencial). */
export const SignScreen = () => {
  const { token } = useParams();
  const [view, setView] = useState<SignView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'done' | 'rejected'>('loading');
  const [typedName, setTypedName] = useState('');
  const [mode, setMode] = useState<'drawn' | 'typed' | 'paper'>('typed');
  const [submitting, setSubmitting] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    fetch(`${API}/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: SignView) => {
        setView(data);
        setTypedName(data.participant?.name ?? '');
        setState(data.alreadySigned ? 'done' : data.rejected ? 'rejected' : data.expired ? 'error' : 'ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  const isDigital = (view?.participant.signatureMethod ?? view?.document.signatureMethod) === 'digital';

  // Canvas (firma dibujada).
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawn.current = true;
    if (!hasStroke) setHasStroke(true);
  };
  const end = () => { drawing.current = false; };
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasDrawn.current = false;
    setHasStroke(false);
  };

  const submit = async (action: 'sign' | 'reject') => {
    setSubmitting(true);
    const payload: Record<string, unknown> = { action };
    if (action === 'sign') {
      payload.typedName = typedName;
      if (!isDigital) payload.mode = mode;
      if (mode === 'drawn' && hasDrawn.current && canvasRef.current) {
        payload.signatureImage = canvasRef.current.toDataURL('image/png');
      }
    }
    try {
      const res = await fetch(`${API}/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      if (action === 'sign') {
        // Refrescar la vista para mostrar el documento firmado + certificación.
        const refreshed = await fetch(`${API}/${token}`).then((r) => (r.ok ? r.json() : null));
        if (refreshed) setView(refreshed);
        setState('done');
      } else {
        setState('rejected');
      }
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  const canSign = isDigital
    ? typedName.trim().length > 1
    : mode === 'paper' || (mode === 'typed' && typedName.trim().length > 1) || (mode === 'drawn' && hasStroke);

  return (
    <div className="vera-sign">
      <div className="vera-sign__card">
        <div className="vera-sign__brand"><ShieldCheck size={18} /> VERA · Firma</div>

        {state === 'loading' && <p className="vera-sign__muted">Cargando documento…</p>}

        {state === 'error' && (
          <div className="vera-sign__state" data-testid="sign-error">
            <X size={28} className="vera-sig-ic--bad" />
            <h1 className="vera-sign__title">Enlace no válido</h1>
            <p className="vera-sign__muted">Este enlace de firma venció o ya fue utilizado. Pedí uno nuevo a tu asesor.</p>
          </div>
        )}

        {state === 'done' && (
          <div data-testid="sign-done">
            <div className="vera-sign__state">
              <Check size={28} className="vera-sig-ic--ok" />
              <h1 className="vera-sign__title">¡Firma registrada!</h1>
              <p className="vera-sign__muted">
                Gracias{view?.participant.name ? `, ${view.participant.name}` : ''}. VERA registró tu firma de forma segura.
              </p>
            </div>

            {view && (
              <div className="vera-sign__printable" data-testid="signed-document">
                <h2 className="vera-signed__doc-title">{view.document.title}</h2>
                <div className="vera-sign__doc">
                  {(view.document.body as { blocks?: { type: string; value: string }[] })?.blocks?.map((b, i) => (
                    <p key={i}>{interpolate(b.value, view.document.resolvedVariables)}</p>
                  )) ?? <p className="vera-sign__muted">Documento sin cuerpo definido.</p>}
                </div>

                <div className="vera-signed__cert" data-testid="signed-cert">
                  <div className="vera-signed__cert-head"><ShieldCheck size={16} /> Certificado de firma · VERA</div>
                  <div className="vera-signed__cert-row"><span>Firmante</span><strong>{view.participant.name ?? '—'}</strong></div>
                  {view.participant.role && <div className="vera-signed__cert-row"><span>Rol</span><strong>{view.participant.role}</strong></div>}
                  <div className="vera-signed__cert-row"><span>Método</span><strong>{view.participant.signatureMethod === 'presencial' ? 'Presencial' : 'Digital'}</strong></div>
                  {view.participant.signedAt && (
                    <div className="vera-signed__cert-row"><span>Fecha</span><strong>{new Date(view.participant.signedAt).toLocaleString('es-AR')}</strong></div>
                  )}
                  {view.participant.signatureData?.image && (
                    <div className="vera-signed__cert-sign">
                      <span>Firma</span>
                      <img src={view.participant.signatureData.image} alt="Firma" />
                    </div>
                  )}
                  {view.participant.signatureData?.hash && (
                    <div className="vera-signed__cert-hash">Hash de integridad: {view.participant.signatureData.hash}</div>
                  )}
                </div>
              </div>
            )}

            <div className="vera-sign__actions vera-sign__actions--noprint">
              <button type="button" className="vera-sign__btn vera-sign__btn--primary" onClick={() => window.print()} data-testid="download-signed">
                <Download size={16} /> Descargar / Imprimir
              </button>
            </div>
          </div>
        )}

        {state === 'rejected' && (
          <div className="vera-sign__state" data-testid="sign-rejected">
            <X size={28} className="vera-sig-ic--bad" />
            <h1 className="vera-sign__title">Firma rechazada</h1>
            <p className="vera-sign__muted">Registramos que no firmaste este documento.</p>
          </div>
        )}

        {state === 'ready' && view && (
          <div data-testid="sign-ready">
            <h1 className="vera-sign__title" data-testid="sign-doc-title">{view.document.title}</h1>
            <p className="vera-sign__who">
              Firmás como <strong>{view.participant.name ?? 'firmante'}</strong>
              {view.participant.role ? ` · ${view.participant.role}` : ''}
            </p>

            <div className="vera-sign__doc">
              {(view.document.body as { blocks?: { type: string; value: string }[] })?.blocks?.map((b, i) => (
                <p key={i}>{interpolate(b.value, view.document.resolvedVariables)}</p>
              )) ?? <p className="vera-sign__muted">Documento sin cuerpo definido.</p>}
            </div>

            {!isDigital && (
              <div className="vera-sign__modes" data-testid="sign-modes">
                <button type="button" className={`vera-chip ${mode === 'typed' ? 'is-on' : ''}`} onClick={() => setMode('typed')} data-testid="mode-typed">Tipear</button>
                <button type="button" className={`vera-chip ${mode === 'drawn' ? 'is-on' : ''}`} onClick={() => setMode('drawn')} data-testid="mode-drawn">Dibujar</button>
                <button type="button" className={`vera-chip ${mode === 'paper' ? 'is-on' : ''}`} onClick={() => setMode('paper')} data-testid="mode-paper">En papel</button>
              </div>
            )}

            {(isDigital || mode === 'typed') && (
              <label className="vera-sign__field">
                <span>Tu nombre completo</span>
                <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Nombre y apellido" data-testid="sign-typed-name" />
              </label>
            )}

            {!isDigital && mode === 'drawn' && (
              <div className="vera-sign__pad">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerLeave={end}
                  data-testid="sign-canvas"
                />
                <button type="button" className="vera-chip" onClick={clearCanvas}>Borrar</button>
              </div>
            )}

            {!isDigital && mode === 'paper' && (
              <p className="vera-sign__muted">Vas a firmar el documento impreso en papel. Confirmá para registrar la firma presencial.</p>
            )}

            {isDigital && (
              <p className="vera-sign__cert"><ShieldCheck size={14} /> Al firmar, VERA genera un certificado con tu nombre, fecha/hora y un hash de integridad.</p>
            )}

            <div className="vera-sign__actions">
              <button type="button" className="vera-sign__btn vera-sign__btn--primary" disabled={!canSign || submitting} onClick={() => submit('sign')} data-testid="sign-submit">
                <PenLine size={16} /> Firmar documento
              </button>
              <button type="button" className="vera-sign__btn vera-sign__btn--ghost" disabled={submitting} onClick={() => submit('reject')} data-testid="sign-reject">
                Rechazar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function interpolate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key as string];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
}

export default SignScreen;
