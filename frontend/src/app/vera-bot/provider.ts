import type { ConversationProvider } from './types';
import { mockConversationProvider } from './providers/mock-provider';

/**
 * Proveedor ACTIVO de conversaciones. Único punto de acoplamiento: cambiar el
 * motor real (Arturito, WhatsApp Cloud, Kommo, Twilio, Evolution…) es reemplazar
 * esta línea por otra implementación de ConversationProvider. La UI no cambia.
 */
export const conversationProvider: ConversationProvider = mockConversationProvider;
