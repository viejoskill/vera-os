import { env } from '@vera/config';

/** Gateway a VERA Brain. Único punto de contacto del front con la inteligencia.
 * Las Apps consumen esto; nunca saben que por detrás razona un modelo concreto. */
const base = `${env.backendUrl}/api/brain`;
const studioBase = `${env.backendUrl}/api/studio`;

/** Entrenamiento editable del cerebro de VERA Studio (persona/estilo). */
export const veraStudioBrain = {
  getTraining: async (): Promise<string> => {
    const res = await fetch(`${studioBase}/training`);
    if (!res.ok) return '';
    return ((await res.json()) as { text: string }).text ?? '';
  },
  setTraining: async (text: string): Promise<void> => {
    const res = await fetch(`${studioBase}/training`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('studio-training-save-failed');
  },
};

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

/** Goals: lo que VERA INTENTA LOGRAR. El razonamiento se hace en función de esto. */
export interface Goal {
  id: string;
  type: string; // sell_property | capture_owners | prioritize_rentals | increase_appraisals | custom
  title: string;
  subject?: string;
  status: string; // active | done | archived
  priority: string; // primary | secondary
  scope?: string; // global | workspace | entity
  scope_type?: string;
  scope_id?: string;
  at: string;
  meta?: Record<string, unknown>;
}

export interface GoalInput {
  type: string;
  title: string;
  subject?: string;
  priority?: string;
  scope?: string; // por defecto 'global'; entity/workspace en el futuro
  scope_type?: string;
  scope_id?: string;
}

export interface ConversationSummary {
  sessionId: string;
  title: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'vera';
  text: string;
  at?: string;
}

export const veraBrain = {
  ask: async (question: string, sessionId?: string, email?: string, mode: 'vera' | 'studio' = 'vera'): Promise<string> => {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId, email, mode }),
    });
    if (!res.ok) throw new Error('brain-ask-failed');
    return ((await res.json()) as { answer: string }).answer;
  },
  /** Lista las conversaciones previas del usuario (para retomar). */
  conversations: async (email: string): Promise<ConversationSummary[]> => {
    try {
      const res = await fetch(`${base}/conversations?email=${encodeURIComponent(email)}`);
      if (!res.ok) return [];
      return ((await res.json()) as { conversations: ConversationSummary[] }).conversations ?? [];
    } catch {
      return [];
    }
  },
  /** Trae los mensajes de una conversación para retomarla. */
  conversation: async (sessionId: string, email: string): Promise<ConversationMessage[]> => {
    try {
      const res = await fetch(
        `${base}/conversations/${encodeURIComponent(sessionId)}?email=${encodeURIComponent(email)}`,
      );
      if (!res.ok) return [];
      return ((await res.json()) as { messages: ConversationMessage[] }).messages ?? [];
    } catch {
      return [];
    }
  },
  deleteConversation: async (sessionId: string, email: string): Promise<void> => {
    await fetch(
      `${base}/conversations/${encodeURIComponent(sessionId)}?email=${encodeURIComponent(email)}`,
      { method: 'DELETE' },
    );
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
  /** Objetivos activos del usuario. */
  goals: async (): Promise<Goal[]> => {
    try {
      const res = await fetch(`${base}/goals`);
      if (!res.ok) return [];
      return ((await res.json()) as { goals: Goal[] }).goals ?? [];
    } catch {
      return [];
    }
  },
  /** Define un nuevo objetivo. VERA razonará en función de él. */
  setGoal: async (goal: GoalInput): Promise<void> => {
    await fetch(`${base}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });
  },
  /** Cambia el estado de un objetivo (active | done | archived). */
  updateGoal: async (id: string, status: string): Promise<void> => {
    await fetch(`${base}/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },
};
