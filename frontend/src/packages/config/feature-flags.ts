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
}

export const featureFlags: FeatureFlags = {
  hoy: true, // "Hoy" — VERA operational Inbox
  veraBot: false, // "Vera Bot" — mensajería principal del sistema (próximamente)
  propiedades: true,
  personas: false,
  operaciones: false,
  studio: false,
};
