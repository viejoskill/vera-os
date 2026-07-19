import type { MessagingProvider } from '../types';

/**
 * Proveedor ARTURITO — motor de mensajería inicial de Vera Bot.
 *
 * Arturito es el agente de IA que centraliza WhatsApp, Instagram, Facebook y
 * chat web, califica leads y agenda visitas. VERA lo integra manteniendo su
 * identidad; no lo reconstruye. Al no exponer (aún) una API pública de bandeja,
 * el modo es `launch`: experiencia nativa VERA + apertura del motor.
 */
export const arturitoProvider: MessagingProvider = {
  id: 'arturito',
  name: 'Arturito',
  brand: 'arturito',
  brandFullColor: true,
  tagline: 'Agente de IA para WhatsApp, Instagram y web',
  description:
    'Responde 24/7, califica leads, muestra propiedades reales y agenda visitas — todo desde tu número de negocio.',
  channels: ['whatsapp', 'instagram', 'facebook', 'web'],
  mode: 'launch',
  url: 'https://app.arturito.ai',
  online: true,
};
