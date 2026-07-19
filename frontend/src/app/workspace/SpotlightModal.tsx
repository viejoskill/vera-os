import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, ArrowUp } from 'lucide-react';
import { veraBrain } from '@app/brain/brain-gateway';
import { useAuthUser } from '@app/auth/useAuthUser';
import { useInsights } from '@app/insights';
import type { InsightsResponse } from '@app/insights/types';

interface Msg {
  role: 'user' | 'vera';
  text: string;
}
interface Suggestion {
  label: string;
  question: string;
}

const TODAY = '__today__';

/** Limpieza ligera de markdown para lectura en burbujas. */
const clean = (t: string): string =>
  t
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*---\s*$/gm, '')
    .trim();

/** VERA abre la conversación de forma proactiva, usando lo que ya encontró hoy. */
const buildOpening = (name: string, data?: InsightsResponse): string => {
  const by = data?.summary.by_type ?? {};
  const parts: string[] = [];
  const push = (n: number | undefined, sing: string, plur: string) => {
    if (n && n > 0) parts.push(`${n} ${n === 1 ? sing : plur}`);
  };
  push(by.opportunity, 'oportunidad comercial', 'oportunidades comerciales');
  push(by.priority, 'propiedad para atender', 'propiedades para atender');
  push(by.risk, 'riesgo', 'riesgos');
  push(by.recommendation, 'recomendación', 'recomendaciones');
  const active = data?.summary.active_conversations ?? 0;
  if (active > 0) parts.push(`${active} ${active === 1 ? 'conversación activa' : 'conversaciones activas'}`);

  const hi = name ? `Hola, ${name}.` : 'Hola.';
  if (parts.length === 0) {
    return `${hi} Revisé todo por vos y por ahora no hay nada urgente. ¿En qué te doy una mano?`;
  }
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  return `${hi} Mientras no estabas revisé todo: encontré ${list}. ¿Por dónde querés empezar?`;
};

/** Sugerencias DINÁMICAS: recomendaciones reales derivadas de los insights de hoy. */
const buildSuggestions = (data?: InsightsResponse): Suggestion[] => {
  const out: Suggestion[] = [{ label: 'Ver el resumen de hoy', question: TODAY }];
  for (const i of (data?.insights ?? []).slice(0, 4)) {
    if (i.type === 'opportunity') {
      const who = String((i.meta as Record<string, unknown>)?.contact_name ?? '').trim();
      if (who) {
        out.push({
          label: `Seguir con ${who.split(/\s+/)[0]}`,
          question: `¿Cómo sigo la conversación con ${who}? Dame contexto y un mensaje sugerido.`,
        });
        continue;
      }
    }
    const title = i.title.length > 34 ? `${i.title.slice(0, 32)}…` : i.title;
    out.push({
      label: title,
      question: `Contame más sobre "${i.title}" y qué me recomendás hacer.`,
    });
  }
  return out.slice(0, 4);
};

/** VERA Expert — la conversación con VERA. No es un buscador: VERA inicia el diálogo
 * de forma proactiva con lo que ya trabajó y ofrece recomendaciones reales del día.
 * El usuario SIEMPRE habla con VERA; la inteligencia responde por detrás, invisible. */
export const SpotlightModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<string>('');
  const [value, setValue] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  const { greetingName } = useAuthUser();
  const { data } = useInsights();
  const dataRef = useRef(data);
  dataRef.current = data;

  const suggestions = useMemo(() => buildSuggestions(data), [data]);

  useEffect(() => {
    if (!open) return;
    sessionRef.current = `vera-expert-${Date.now()}`;
    setValue('');
    setMessages([{ role: 'vera', text: buildOpening(greetingName, dataRef.current) }]);
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, greetingName]);

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

  const handleSuggestion = (s: Suggestion) => {
    if (s.question === TODAY) askToday();
    else send(s.question);
  };

  return createPortal(
    <div className="vera-spot" data-testid="spotlight-modal" onClick={onClose}>
      <div className="vera-spot__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="vera-spot__header">
          <span className="vera-spot__identity">
            <span className="vera-spot__orb" aria-hidden="true">
              <Sparkles size={14} />
            </span>
            <span className="vera-spot__identity-text">
              <strong>VERA</strong>
              <span className="vera-spot__identity-sub">Tu inteligencia de trabajo</span>
            </span>
          </span>
          <button
            type="button"
            className="vera-spot__close"
            data-testid="spotlight-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <div className="vera-spot__thread" data-testid="spotlight-thread" ref={threadRef}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`vera-spot__msg vera-spot__msg--${m.role}`}
              data-testid={`spotlight-message-${m.role}`}
            >
              {m.role === 'vera' && (
                <span className="vera-spot__msg-badge">
                  <Sparkles size={12} /> VERA
                </span>
              )}
              <p>{m.text}</p>
            </div>
          ))}
          {loading && (
            <div className="vera-spot__msg vera-spot__msg--vera" data-testid="spotlight-thinking">
              <span className="vera-spot__msg-badge">
                <Sparkles size={12} /> VERA
              </span>
              <p className="vera-spot__typing">
                <span />
                <span />
                <span />
              </p>
            </div>
          )}
        </div>

        {!loading && (
          <div className="vera-spot__suggest" data-testid="spotlight-suggestions">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                className="vera-spot__chip"
                data-testid={`spotlight-suggestion-${s.label.slice(0, 14)}`}
                onClick={() => handleSuggestion(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="vera-spot__field">
          <input
            ref={inputRef}
            className="vera-spot__input"
            data-testid="spotlight-input"
            placeholder="Respondé o escribí lo que quieras…"
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
              aria-label="Enviar"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
