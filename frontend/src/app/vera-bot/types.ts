/**
 * Vera Bot — capa de INTEGRACIÓN desacoplada.
 *
 * VERA no reconstruye el motor de mensajería: lo orquesta. El motor real
 * (Arturito hoy; WhatsApp Cloud / Kommo / Twilio / Evolution mañana) se expone
 * a través de este único contrato. Reemplazar el proveedor = implementar
 * `MessagingProvider` y cambiar una línea en `provider.ts`. El resto de VERA OS
 * no se toca.
 */
export type MessagingChannel = 'whatsapp' | 'instagram' | 'facebook' | 'web' | 'email';

/** Cómo VERA superficie el motor. Hoy `launch` (experiencia nativa + apertura). */
export type MessagingMode = 'launch' | 'embed';

export interface MessagingProvider {
  /** Identificador del motor (p.ej. 'arturito'). */
  readonly id: string;
  /** Nombre visible del motor. */
  readonly name: string;
  /** Clave de BrandRegistry para el logo (con fallback vectorial). */
  readonly brand: string;
  /** Descriptor corto del motor. */
  readonly tagline: string;
  /** Descripción de una línea sobre qué hace el motor dentro del flujo comercial. */
  readonly description: string;
  /** Canales que el motor centraliza. */
  readonly channels: MessagingChannel[];
  /** Modo de integración con el que VERA lo presenta. */
  readonly mode: MessagingMode;
  /** Destino a abrir cuando el modo es `launch`. */
  readonly url: string;
  /** Si el motor está conectado/operativo (alimenta la cápsula de estado). */
  readonly online: boolean;
}
