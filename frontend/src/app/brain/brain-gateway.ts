import { env } from '@vera/config';

/** Gateway a VERA Brain. Único punto de contacto del front con la inteligencia.
 * Las Apps consumen esto; nunca saben que por detrás razona un modelo concreto. */
const base = `${env.backendUrl}/api/brain`;

export interface MemoryItem {
  kind: string;
  note: string;
  at: string;
}

export const veraBrain = {
  ask: async (question: string, sessionId?: string): Promise<string> => {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId }),
    });
    if (!res.ok) throw new Error('brain-ask-failed');
    return ((await res.json()) as { answer: string }).answer;
  },
  today: async (): Promise<string> => {
    const res = await fetch(`${base}/today`);
    if (!res.ok) throw new Error('brain-today-failed');
    return ((await res.json()) as { briefing: string }).briefing;
  },
  /** Lo que VERA recuerda (decisiones/notas) para no arrancar de cero. */
  memory: async (): Promise<MemoryItem[]> => {
    try {
      const res = await fetch(`${base}/memory`);
      if (!res.ok) return [];
      return ((await res.json()) as { memory: MemoryItem[] }).memory ?? [];
    } catch {
      return [];
    }
  },
  /** Registra una decisión para que VERA la tenga en cuenta la próxima vez. */
  remember: async (note: string, kind = 'decision'): Promise<void> => {
    await fetch(`${base}/remember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, kind }),
    });
  },
};
