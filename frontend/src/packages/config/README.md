# @vera/config

Centralized configuration: **the app's control panel**.

## Purpose

One place for environment variables, global constants and feature flags, so no other
package reads `process.env` or hardcodes global settings.

## Responsibilities

- `env` — typed, validated access to environment variables.
- `appConfig` — static global config (name, locale, default currency).
- `featureFlags` — enable/disable Apps and capabilities without code changes elsewhere.

## Dependencies

None.

## Extension points

- Add remote/runtime feature flags by swapping `featureFlags` for a loader with the same shape.
- Add per-environment config maps keyed by `env.nodeEnv`.
