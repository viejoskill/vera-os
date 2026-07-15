/**
 * Feature Flags — the switchboard that decides which Apps/capabilities are live.
 * Navigation and screens read these; flipping a flag is the extension mechanism.
 */

export interface FeatureFlags {
  hoy: boolean;
  propiedades: boolean;
  operaciones: boolean;
  studio: boolean;
  veraAi: boolean;
}

export const featureFlags: FeatureFlags = {
  hoy: false, // arrives in a later sprint
  propiedades: true, // Sprint 0A vertical slice
  operaciones: false,
  studio: false,
  veraAi: true, // mocked AI briefing
};
