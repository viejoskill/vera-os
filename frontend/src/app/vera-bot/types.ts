/**
 * Vera Bot — contratos de mensajería. VERA BOT es el producto; el proveedor de
 * conversaciones es intercambiable (mock hoy; Arturito / WhatsApp Cloud / Kommo /
 * Twilio / Evolution mañana) sin tocar la UI.
 */
export type Channel = 'whatsapp' | 'web' | 'instagram' | 'facebook' | 'email';

export type MessageSender = 'contact' | 'agent' | 'bot';

export interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  text: string;
  at: string; // ISO
}

export interface Conversation {
  id: string;
  name: string;
  channel: Channel;
  lastMessage: string;
  lastAt: string; // ISO
  unread: number;
}

/** Contrato único que consume Vera Bot. Cambiar de motor = implementar esta interfaz. */
export interface ConversationProvider {
  /** Identificador del motor actual (p.ej. 'mock', 'arturito'). */
  readonly id: string;
  /** Si el motor puede enviar/recibir en vivo. Mock = false → UI en modo "Conectando…". */
  readonly canSend: boolean;
  listConversations(): Promise<Conversation[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, text: string): Promise<Message>;
}
