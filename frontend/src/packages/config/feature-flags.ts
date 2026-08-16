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
  documentos: boolean;
  studio: boolean;
  integraciones: boolean;
  eventLog: boolean;
  alquileres: boolean;
}

export const featureFlags: FeatureFlags = {
  hoy: true, // "Hoy" — VERA operational Inbox
  veraBot: true, // "Vera Bot" — integración de mensajería (motor: Arturito)
  propiedades: true,
  personas: true,
  operaciones: false, // OCULTO — el usuario no usa el tablero operativo (pipeline sin alimentar)
  documentos: true, // "Documentos" — motor documental (Templates + Documents). Sprint fundacional.
  studio: true, // "Studio" — herramienta de contenido de redes, embebida (public/vera-studio.html)
  integraciones: true, // "Integraciones" — Centro de Integraciones (Sprint 05)
  eventLog: false, // OCULTO — vista técnica de debug, sin uso para el usuario final
  alquileres: true, // "Alquileres Temporarios" — gestión de rentas de verano + web de reservas
};
