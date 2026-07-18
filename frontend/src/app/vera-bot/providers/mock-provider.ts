import type { Conversation, ConversationProvider, Message } from '../types';

/** Proveedor MOCK — construye la experiencia sin motor real. `canSend=false`. */
const CONVERSATIONS: Conversation[] = [
  { id: 'c1', name: 'María González', channel: 'whatsapp', lastMessage: '¿Sigue disponible la casa de Costa del Este?', lastAt: '2026-07-18T16:42:00Z', unread: 2 },
  { id: 'c2', name: 'Carlos Ruiz', channel: 'instagram', lastMessage: 'Me interesa coordinar una visita 🙌', lastAt: '2026-07-18T15:10:00Z', unread: 0 },
  { id: 'c3', name: 'Laura Fernández', channel: 'web', lastMessage: 'Gracias, quedo atenta al presupuesto.', lastAt: '2026-07-18T12:05:00Z', unread: 1 },
  { id: 'c4', name: 'Estudio Molina', channel: 'facebook', lastMessage: '¿Aceptan permuta por depto en CABA?', lastAt: '2026-07-17T19:30:00Z', unread: 0 },
  { id: 'c5', name: 'Diego Pérez', channel: 'whatsapp', lastMessage: 'Perfecto, agendo para el jueves.', lastAt: '2026-07-17T11:20:00Z', unread: 0 },
];

const MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: 'm1', conversationId: 'c1', sender: 'contact', text: 'Hola! Vi la publicación de la casa 3 ambientes en Costa del Este.', at: '2026-07-18T16:38:00Z' },
    { id: 'm2', conversationId: 'c1', sender: 'bot', text: '¡Hola María! Sí, sigue disponible. Es a estrenar, con parrilla y a 3 cuadras del mar. ¿Querés que coordinemos una visita?', at: '2026-07-18T16:39:00Z' },
    { id: 'm3', conversationId: 'c1', sender: 'contact', text: '¿Sigue disponible la casa de Costa del Este?', at: '2026-07-18T16:42:00Z' },
  ],
  c2: [
    { id: 'm4', conversationId: 'c2', sender: 'contact', text: 'Me interesa coordinar una visita 🙌', at: '2026-07-18T15:10:00Z' },
  ],
  c3: [
    { id: 'm5', conversationId: 'c3', sender: 'agent', text: 'Hola Laura, te paso el presupuesto por acá en un rato.', at: '2026-07-18T12:00:00Z' },
    { id: 'm6', conversationId: 'c3', sender: 'contact', text: 'Gracias, quedo atenta al presupuesto.', at: '2026-07-18T12:05:00Z' },
  ],
  c4: [
    { id: 'm7', conversationId: 'c4', sender: 'contact', text: '¿Aceptan permuta por depto en CABA?', at: '2026-07-17T19:30:00Z' },
  ],
  c5: [
    { id: 'm8', conversationId: 'c5', sender: 'bot', text: 'Te propongo el jueves 16 hs para la visita, ¿te sirve?', at: '2026-07-17T11:18:00Z' },
    { id: 'm9', conversationId: 'c5', sender: 'contact', text: 'Perfecto, agendo para el jueves.', at: '2026-07-17T11:20:00Z' },
  ],
};

const delay = <T,>(v: T) => new Promise<T>((r) => window.setTimeout(() => r(v), 250));

export const mockConversationProvider: ConversationProvider = {
  id: 'mock',
  canSend: false,
  listConversations: () => delay(CONVERSATIONS),
  getMessages: (conversationId) => delay(MESSAGES[conversationId] ?? []),
  sendMessage: () => Promise.reject(new Error('engine-not-connected')),
};
