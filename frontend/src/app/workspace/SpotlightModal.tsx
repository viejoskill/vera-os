import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ArrowUp, Sun, Building2, Megaphone, ClipboardList } from 'lucide-react';
import { veraBrain } from '@app/brain/brain-gateway';

interface Msg {
  role: 'user' | 'vera';
  text: string;
}

const SUGGESTIONS = [
  { icon: Building2, text: '¿Cómo cargo una propiedad nueva en VERA?' },
  { icon: Megaphone, text: '¿Qué hace única a VERA frente a un CRM?' },
  { icon: ClipboardList, text: '¿Qué integraciones puedo conectar?' },
];

/** Limpieza ligera de markdown para lectura en burbujas. */
const clean = (t: string): string =>
  t
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*---\s*$/gm, '')
    .trim();

/** VERA Expert — la superficie de VERA Brain. El usuario SIEMPRE habla con VERA;
 * la inteligencia responde por detrás, invisible. No es un chatbot de un modelo:
 * es VERA entendiendo su negocio. */
export const SpotlightModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<string>('');
  const [value, setValue] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    sessionRef.current = `vera-expert-${Date.now()}`;
    setMessages([]);
    setValue('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  if (!open) return null;

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setValue('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const answer = await veraBrain.ask(q, sessionRef.current);
      setMessages((m) => [...m, { role: 'vera', text: clean(answer) }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'vera', text: 'No pude responder en este momento. Probá de nuevo en unos segundos.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const askToday = async () => {
    if (loading) return;
    setMessages((m) => [...m, { role: 'user', text: '¿Qué pasó hoy?' }]);
    setLoading(true);
    try {
      const briefing = await veraBrain.today();
      setMessages((m) => [...m, { role: 'vera', text: clean(briefing) }]);
    } catch {
      setMessages((m) => [...m, { role: 'vera', text: 'No pude generar el resumen ahora.' }]);
    } finally {
      setLoading(false);
    }
  };

  const empty = messages.length === 0 && !loading;

  return createPortal(
    <div className="vera-spot" data-testid="spotlight-modal" onClick={onClose}>
      <div className="vera-spot__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="vera-spot__field">
          <Sparkles size={18} className="vera-spot__search-icon" />
          <input
            ref={inputRef}
            className="vera-spot__input"
            data-testid="spotlight-input"
            placeholder="Preguntale a VERA…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(value)}
          />
          {value.trim() && (
            <button
              type="button"
              className="vera-spot__send"
              data-testid="spotlight-send"
              onClick={() => send(value)}
              aria-label="Preguntar"
            >
              <ArrowUp size={16} />
            </button>
          )}
          <button type="button" className="vera-spot__close" data-testid="spotlight-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {empty ? (
          <>
            <button type="button" className="vera-spot__today" data-testid="spotlight-today" onClick={askToday}>
              <span className="vera-spot__today-icon"><Sun size={16} /></span>
              <span>
                <strong>¿Qué pasó hoy?</strong>
                <span className="vera-spot__today-sub">Tu resumen del día, con contexto</span>
              </span>
            </button>
            <div className="vera-spot__actions">
              <span className="vera-spot__label">Preguntá lo que quieras</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  className="vera-spot__action"
                  data-testid={`spotlight-suggestion-${s.text.slice(0, 12)}`}
                  onClick={() => send(s.text)}
                >
                  <s.icon size={16} /> {s.text}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="vera-spot__thread" data-testid="spotlight-thread" ref={threadRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`vera-spot__msg vera-spot__msg--${m.role}`}
                data-testid={`spotlight-message-${m.role}`}
              >
                {m.role === 'vera' && <span className="vera-spot__msg-badge"><Sparkles size={12} /> VERA</span>}
                <p>{m.text}</p>
              </div>
            ))}
            {loading && (
              <div className="vera-spot__msg vera-spot__msg--vera" data-testid="spotlight-thinking">
                <span className="vera-spot__msg-badge"><Sparkles size={12} /> VERA</span>
                <p className="vera-spot__typing"><span /><span /><span /></p>
              </div>
            )}
          </div>
        )}

        <div className="vera-spot__hint">
          <Sparkles size={13} /> Hablás con VERA. Tu inteligencia conoce tu negocio, tus herramientas y tu forma de trabajar.
        </div>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
