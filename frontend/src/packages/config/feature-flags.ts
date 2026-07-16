/**
 * Feature Flags — the switchboard that decides which Apps/capabilities are live.
 * Navigation and screens read these; flipping a flag is the extension mechanism.
 */

export interface FeatureFlags {
  hoy: boolean;
  propiedades: boolean;
  operaciones: boolean;
  studio: boolean;
}

export const featureFlags: FeatureFlags = {
  hoy: true, // "Hoy" — VERA operational Inbox
  propiedades: true,
  operaciones: false,
  studio: false,
};
