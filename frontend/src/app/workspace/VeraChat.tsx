import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp, Plus, History, Trash2, Palette, Copy, Check, GraduationCap, X, Maximize2, Minimize2 } from 'lucide-react';
import { veraBrain, veraStudioBrain, type ConversationSummary } from '@app/brain/brain-gateway';
import { VeraMessage } from './VeraMessage';
import { useAuthUser } from '@app/auth/useAuthUser';
import { useAuth } from '@app/auth/AuthProvider';

type Mode = 'vera' | 'studio';

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

const clean = (t: string): string =>
  t
    .replace(/^\s*---\s*$/gm, '')
    .trim();

const newSession = (mode: Mode) => `vera-${mode}-${Date.now()}`;

const SUGGESTIONS: Record<Mode, string[]> = {
  vera: [
    '¿Qué pasó hoy en la inmobiliaria?',
    '¿Qué leads necesito responder?',
    '¿Cómo funciona el módulo de Documentos?',
    'Ayudame a redactar un mensaje para un cliente',
  ],
  studio: [
    'Necesito ideas de contenido para una propiedad del Radar',
    'Un carrusel para captar propietarios este finde largo',
    'Ideas de reel / video para TikTok de la inmobiliaria',
    'Una historia distinta, que no suba cualquier inmobiliaria',
  ],
};

/** VERA Chat — conversación con VERA (Claude), con memoria e historial por usuario. */
export const VeraChat = () => {
  const { greetingName } = useAuthUser();
  const { session } = useAuth();
  const email = session?.user?.email ?? 'anon';

  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionRef = useRef<string>(newSession('vera'));

  const [mode, setMode] = useState<Mode>('vera');
  const [value, setValue] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [showTrain, setShowTrain] = useState(false);
  const [trainText, setTrainText] = useState('');
  const [trainState, setTrainState] = useState<'idle' | 'loading' | 'saving' | 'saved'>('idle');

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const openTraining = async () => {
    setShowTrain(true);
    setTrainState('loading');
    try {
      setTrainText(await veraStudioBrain.getTraining());
    } finally {
      setTrainState('idle');
    }
  };

  const saveTraining = async () => {
    setTrainState('saving');
    try {
      await veraStudioBrain.setTraining(trainText);
      setTrainState('saved');
      setTimeout(() => setTrainState('idle'), 1600);
    } catch {
      setTrainState('idle');
    }
  };

  const refreshHistory = useCallback(async () => {
    setConversations(await veraBrain.conversations(email));
  }, [email]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

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
      const answer = await veraBrain.ask(q, sessionRef.current, email, mode);
      setMessages((m) => [...m, { role: 'vera', text: clean(answer) }]);
      refreshHistory();
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

  const startNew = () => {
    sessionRef.current = newSession(mode);
    setMessages([]);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    sessionRef.current = newSession(m);
    setMessages([]);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const copyMsg = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  const openConversation = async (sessionId: string) => {
    sessionRef.current = sessionId;
    setMode(sessionId.startsWith('vera-studio-') ? 'studio' : 'vera');
    setShowHistory(false);
    setLoading(true);
    const msgs = await veraBrain.conversation(sessionId, email);
    setMessages(msgs.map((m) => ({ role: m.role, text: clean(m.text) })));
    setLoading(false);
  };

  const removeConversation = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await veraBrain.deleteConversation(sessionId, email);
    if (sessionId === sessionRef.current) startNew();
    refreshHistory();
  };

  const empty = messages.length === 0;
  const isStudio = mode === 'studio';

  return (
    <>
      {expanded && <div className="vera-chat__backdrop" data-testid="vera-chat-backdrop" onClick={() => setExpanded(false)} />}
    <section
      className={`vera-chat${isStudio ? ' vera-chat--studio' : ''}${expanded ? ' vera-chat--expanded' : ''}`}
      data-testid="vera-chat"
    >
      <header className="vera-chat__bar">
        <div className="vera-chat__modes" role="tablist" aria-label="Modo de VERA">
          <button
            type="button"
            role="tab"
            aria-selected={!isStudio}
            className={`vera-chat__mode${!isStudio ? ' is-active' : ''}`}
            data-testid="vera-chat-mode-vera"
            onClick={() => switchMode('vera')}
          >
            <Sparkles size={14} /> VERA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isStudio}
            className={`vera-chat__mode${isStudio ? ' is-active' : ''}`}
            data-testid="vera-chat-mode-studio"
            onClick={() => switchMode('studio')}
          >
            <Palette size={14} /> Studio
          </button>
        </div>
        <div className="vera-chat__bar-actions">
          {isStudio && (
            <button
              type="button"
              className="vera-chat__bar-btn"
              data-testid="vera-chat-train"
              onClick={openTraining}
            >
              <GraduationCap size={15} /> Entrenar
            </button>
          )}
          <button
            type="button"
            className="vera-chat__bar-btn"
            data-testid="vera-chat-history-toggle"
            onClick={() => setShowHistory((s) => !s)}
          >
            <History size={15} /> Historial
          </button>
          <button
            type="button"
            className="vera-chat__bar-btn"
            data-testid="vera-chat-new"
            onClick={startNew}
          >
            <Plus size={15} /> Nueva
          </button>
          <button
            type="button"
            className="vera-chat__bar-btn vera-chat__bar-btn--expand"
            data-testid="vera-chat-expand"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Reducir' : 'Ampliar'}
            title={expanded ? 'Reducir' : 'Ampliar ventana'}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {expanded ? 'Reducir' : 'Ampliar'}
          </button>
        </div>
      </header>

      {showTrain && (
        <div className="vera-train" data-testid="vera-train" onClick={() => setShowTrain(false)}>
          <div className="vera-train__panel" onClick={(e) => e.stopPropagation()}>
            <div className="vera-train__head">
              <span className="vera-train__title"><GraduationCap size={16} /> Entrenar a VERA Studio</span>
              <button
                type="button"
                className="vera-train__close"
                data-testid="vera-train-close"
                onClick={() => setShowTrain(false)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
            <p className="vera-train__hint">
              Escribí en tus palabras cómo querés que piense y escriba VERA Studio: tono, palabras a evitar,
              público prioritario, muletillas de la marca, ejemplos de frases. Esto guía tanto el chat como la
              herramienta de contenido (un solo cerebro).
            </p>
            <textarea
              className="vera-train__textarea"
              data-testid="vera-train-textarea"
              placeholder={
                'Ej: Tono cercano rioplatense, nunca uses la palabra "soñado". Priorizá inversores y familias jóvenes. Mencioná los pinares y la tranquilidad de Costa del Este cuando encaje…'
              }
              value={trainText}
              onChange={(e) => setTrainText(e.target.value)}
              rows={10}
              disabled={trainState === 'loading'}
            />
            <div className="vera-train__actions">
              <span className="vera-train__status">
                {trainState === 'loading' && 'Cargando…'}
                {trainState === 'saving' && 'Guardando…'}
                {trainState === 'saved' && '✓ Guardado. VERA ya piensa así.'}
              </span>
              <button
                type="button"
                className="vera-train__save"
                data-testid="vera-train-save"
                onClick={saveTraining}
                disabled={trainState === 'saving' || trainState === 'loading'}
              >
                Guardar entrenamiento
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="vera-chat__history" data-testid="vera-chat-history">
          {conversations.length === 0 ? (
            <p className="vera-chat__history-empty">Todavía no hay conversaciones guardadas.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.sessionId}
                type="button"
                className="vera-chat__history-item"
                data-testid="vera-chat-history-item"
                onClick={() => openConversation(c.sessionId)}
              >
                <span className="vera-chat__history-title">{c.title}</span>
                <span
                  className="vera-chat__history-del"
                  data-testid="vera-chat-history-delete"
                  onClick={(e) => removeConversation(e, c.sessionId)}
                >
                  <Trash2 size={13} />
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="vera-chat__thread" data-testid="vera-chat-thread" ref={threadRef}>
        {empty && (
          <div className="vera-chat__welcome" data-testid="vera-chat-welcome">
            <span className="vera-chat__orb" aria-hidden="true">
              {isStudio ? <Palette size={22} /> : <Sparkles size={22} />}
            </span>
            <h1 className="vera-chat__greeting">
              {isStudio ? 'VERA Studio' : `${greeting()}, ${greetingName}.`}
            </h1>
            <p className="vera-chat__lead">
              {isStudio
                ? 'Soy tu directora creativa. Contame qué necesitás (o sobre qué propiedad) y te propongo ideas de contenido con impronta propia — carruseles, historias, reels y videos para TikTok.'
                : 'Soy VERA. Preguntame lo que quieras del sistema o de tu inmobiliaria.'}
            </p>
            <div className="vera-chat__suggest">
              {SUGGESTIONS[mode].map((s) => (
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
              <div className="vera-chat__msg-head">
                <span className="vera-chat__msg-badge">
                  {isStudio ? <Palette size={12} /> : <Sparkles size={12} />} {isStudio ? 'STUDIO' : 'VERA'}
                </span>
                <button
                  type="button"
                  className="vera-chat__copy"
                  data-testid="vera-chat-copy"
                  onClick={() => copyMsg(m.text, i)}
                  aria-label="Copiar respuesta"
                >
                  {copiedIdx === i ? <Check size={13} /> : <Copy size={13} />}
                  {copiedIdx === i ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            )}
            {m.role === 'vera' ? <VeraMessage text={m.text} /> : <p>{m.text}</p>}
          </div>
        ))}

        {loading && (
          <div className="vera-chat__msg vera-chat__msg--vera" data-testid="vera-chat-thinking">
            <span className="vera-chat__msg-badge">
              {isStudio ? <Palette size={12} /> : <Sparkles size={12} />} {isStudio ? 'STUDIO' : 'VERA'}
            </span>
            <p className="vera-chat__typing"><span /><span /><span /></p>
          </div>
        )}
      </div>

      <div className="vera-chat__field">
        <textarea
          ref={inputRef}
          className="vera-chat__input"
          data-testid="vera-chat-input"
          placeholder={isStudio ? 'Pedile ideas a VERA Studio…' : 'Escribí tu pregunta para VERA…'}
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
    </>
  );
};

export default VeraChat;
