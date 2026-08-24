import { useRef, useState } from 'react';
import { Bot, Send, RotateCcw } from 'lucide-react';
import { env } from '@vera/config';

interface Msg { rol: 'user' | 'bot'; texto: string }

export const RentalBotSimulator = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scroll = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { rol: 'user', texto: text }]);
    setSending(true);
    scroll();
    try {
      const res = await fetch(`${env.backendUrl}/api/rentals/bot/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Error');
      setSid(data.sessionId);
      setMessages((m) => [...m, { rol: 'bot', texto: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { rol: 'bot', texto: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setSending(false);
      scroll();
    }
  };

  const reset = () => { setMessages([]); setSid(null); setInput(''); };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 4px 32px' }} data-testid="rental-bot-simulator">
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(143,227,196,0.14)', color: '#8fe3c4', border: '1px solid rgba(143,227,196,0.3)' }}>
          <Bot size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>Bot de Alquileres · Simulador</h1>
          <p style={{ margin: '2px 0 0', color: '#9a9a95', fontSize: 13 }}>Probá la pre-atención sin WhatsApp. Usa tus propiedades, precios y disponibilidad reales.</p>
        </div>
        <button onClick={reset} data-testid="bot-reset" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#c9c9c4', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 13 }}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </header>

      <div style={{ background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, minHeight: 380, maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="bot-thread">
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#6b6b66', fontSize: 13, maxWidth: 360 }}>
            Escribí como si fueras un cliente. Ej: <br /><em>"Hola, busco algo para 4 personas del 10 al 15 de enero, ¿tenés?"</em>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} data-testid={`bot-msg-${m.rol}`} style={{ alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '10px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap',
          background: m.rol === 'user' ? '#F6E63A' : '#242422', color: m.rol === 'user' ? '#1c1c1c' : '#f1f1ec',
          borderBottomRightRadius: m.rol === 'user' ? 4 : 14, borderBottomLeftRadius: m.rol === 'user' ? 14 : 4 }}>
            {m.texto}
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', color: '#8fe3c4', fontSize: 13, padding: '4px 6px' }} data-testid="bot-typing">escribiendo…</div>}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Escribí un mensaje…"
          data-testid="bot-input"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 12, background: '#1a1a18', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, outline: 'none' }}
        />
        <button onClick={send} disabled={sending || !input.trim()} data-testid="bot-send" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 18px', borderRadius: 12, background: '#8fe3c4', color: '#0f2a22', border: 'none', fontWeight: 700, cursor: sending ? 'default' : 'pointer', opacity: sending || !input.trim() ? 0.5 : 1 }}>
          <Send size={16} /> Enviar
        </button>
      </div>
    </div>
  );
};

export default RentalBotSimulator;
