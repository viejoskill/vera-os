import { useQuery } from '@tanstack/react-query';
import { conversationProvider } from './provider';

export const useConversations = () =>
  useQuery({
    queryKey: ['vera-bot', 'conversations', conversationProvider.id],
    queryFn: () => conversationProvider.listConversations(),
  });

export const useMessages = (conversationId?: string) =>
  useQuery({
    queryKey: ['vera-bot', 'messages', conversationProvider.id, conversationId],
    queryFn: () => conversationProvider.getMessages(conversationId as string),
    enabled: Boolean(conversationId),
  });

/** Estado del motor de mensajería (para "Conectando con el motor…"). */
export const useEngine = () => ({ id: conversationProvider.id, canSend: conversationProvider.canSend });
