import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp } from 'lucide-react';
import { veraBrain } from '@app/brain/brain-gateway';
import { useAuthUser } from '@app/auth/useAuthUser';

interface Msg {
  role: 'user' | 'vera';
  text: string;
}

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

/** Limpieza ligera de markdown para lectura en burbujas. */
const clean = (t: string): string =>
  t
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*---\s*$/gm, '')
    .trim();

const SUGGESTIONS = [
  '¿Qué pasó hoy en la inmobiliaria?',
  '¿Qué leads necesito responder?',
  '¿Cómo funciona el módulo de Documentos?',
  'Ayudame a redactar un mensaje para un cliente',
];

/** VERA Chat — la conversación con VERA (Claude) embebida en "Hoy".
 * Protagonista de la pantalla: preguntá cualquier cosa del sistema o del negocio. */
export const VeraChat = () => {
  const { greetingName } = useAuthUser();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionRef = useRef<string>(`vera-hoy-${Date.now()}`);
  const [value, setValue] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

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
      inputRef.current?.focus();
    }
  };

  const empty = messages.length === 0;

  return (
    <section className="vera-chat" data-testid="vera-chat">
      <div className="vera-chat__thread" data-testid="vera-chat-thread" ref={threadRef}>
        {empty && (
          <div className="vera-chat__welcome" data-testid="vera-chat-welcome">
            <span className="vera-chat__orb" aria-hidden="true"><Sparkles size={22} /></span>
            <h1 className="vera-chat__greeting">{greeting()}, {greetingName}.</h1>
            <p className="vera-chat__lead">
              Soy VERA. Preguntame lo que quieras del sistema o de tu inmobiliaria.
            </p>
            <div className="vera-chat__suggest">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="vera-chat__chip"
                  data-testid="vera-chat-suggestion"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`vera-chat__msg vera-chat__msg--${m.role}`}
            data-testid={`vera-chat-message-${m.role}`}
          >
            {m.role === 'vera' && (
              <span className="vera-chat__msg-badge"><Sparkles size={12} /> VERA</span>
            )}
            <p>{m.text}</p>
          </div>
        ))}

        {loading && (
          <div className="vera-chat__msg vera-chat__msg--vera" data-testid="vera-chat-thinking">
            <span className="vera-chat__msg-badge"><Sparkles size={12} /> VERA</span>
            <p className="vera-chat__typing"><span /><span /><span /></p>
          </div>
        )}
      </div>

      <div className="vera-chat__field">
        <textarea
          ref={inputRef}
          className="vera-chat__input"
          data-testid="vera-chat-input"
          placeholder="Escribí tu pregunta para VERA…"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(value);
            }
          }}
        />
        <button
          type="button"
          className="vera-chat__send"
          data-testid="vera-chat-send"
          onClick={() => send(value)}
          disabled={!value.trim() || loading}
          aria-label="Enviar"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </section>
  );
};

export default VeraChat;
