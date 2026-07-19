import { env } from '@vera/config';

/** Gateway a VERA Brain. Único punto de contacto del front con la inteligencia.
 * Las Apps consumen esto; nunca saben que por detrás razona un modelo concreto. */
const base = `${env.backendUrl}/api/brain`;

/** Memoria estructurada: lo que VERA APRENDIÓ (≠ Knowledge). */
export interface MemoryItem {
  id?: string;
  type: string; // decision | preference | relationship | context | learned_pattern
  subject?: string;
  action?: string;
  detail: string;
  confidence?: number;
  at: string;
  meta?: Record<string, unknown>;
}

export interface MemoryInput {
  type: string;
  subject?: string;
  action?: string;
  detail: string;
  confidence?: number;
  meta?: Record<string, unknown>;
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
  /** Lo que VERA aprendió, filtrable por tipo (y por sujeto). */
  memory: async (type?: string, subject?: string): Promise<MemoryItem[]> => {
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (subject) params.set('subject', subject);
      const qs = params.toString();
      const res = await fetch(`${base}/memory${qs ? `?${qs}` : ''}`);
      if (!res.ok) return [];
      return ((await res.json()) as { memory: MemoryItem[] }).memory ?? [];
    } catch {
      return [];
    }
  },
  /** Registra un recuerdo estructurado para que VERA lo tenga en cuenta a futuro. */
  remember: async (entry: MemoryInput): Promise<void> => {
    await fetch(`${base}/remember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  },
};
