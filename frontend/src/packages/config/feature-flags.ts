/**
 * Feature Flags — the switchboard that decides which Apps/capabilities are live.
 * Navigation and screens read these; flipping a flag is the extension mechanism.
 */

export interface FeatureFlags {
  hoy: boolean;
  veraBot: boolean;
  propiedades: boolean;
  personas: boolean;
  operaciones: boolean;
  studio: boolean;
  integraciones: boolean;
  eventLog: boolean;
}

export const featureFlags: FeatureFlags = {
  hoy: true, // "Hoy" — VERA operational Inbox
  veraBot: true, // "Vera Bot" — integración de mensajería (motor: Arturito)
  propiedades: true,
  personas: true,
  operaciones: true, // "Operaciones" — tablero operativo (Leads/Oportunidades/Tareas/Actividad)
  studio: false,
  integraciones: true, // "Integraciones" — Centro de Integraciones (Sprint 05)
  eventLog: true, // "Event Log" — vista técnica del Conversation Event Pipeline (dev/debug)
};
