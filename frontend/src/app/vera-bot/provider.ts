import type { MessagingProvider } from './types';
import { arturitoProvider } from './providers/arturito-provider';

/**
 * Proveedor ACTIVO de mensajería. Único punto de acoplamiento del sistema:
 * cambiar de motor (Arturito → WhatsApp Cloud / Kommo / Twilio / Evolution…)
 * es reemplazar esta línea por otra implementación de MessagingProvider.
 * La experiencia de Vera Bot y el resto de VERA OS permanecen intactos.
 */
export const messagingProvider: MessagingProvider = arturitoProvider;
