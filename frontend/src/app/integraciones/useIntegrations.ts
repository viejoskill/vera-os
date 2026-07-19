import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { env } from '@vera/config';
import { useAuthUser } from '@app/auth/useAuthUser';
import { INTEGRATIONS } from './catalog';
import type { IntegrationHealth, IntegrationState, SiteConfig } from './types';

const KEY = (email: string) => `vera:integrations:${email || 'anon'}`;

const emptySite = (): SiteConfig => ({ domains: [], primary: null });

const seed = (): Record<string, IntegrationState> =>
  INTEGRATIONS.reduce<Record<string, IntegrationState>>((acc, i) => {
    acc[i.key] = {
      connected: Boolean(i.defaultConnected),
      lastSyncAt: i.defaultConnected ? new Date().toISOString() : null,
      ...(i.configurable ? { config: emptySite() } : {}),
    };
    return acc;
  }, {});

export const normalizeUrl = (raw: string): string => {
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//i, '');
  }
};

/** Estado (simulado, persistido) de las integraciones — FUENTE ÚNICA de la
 * configuración de conexión. Ninguna App guarda datos propios: todas consumen
 * de acá. Arturito viene conectado; su SALUD es real (backend). */
export const useIntegrations = () => {
  const { email } = useAuthUser();
  const [state, setState] = useState<Record<string, IntegrationState>>(seed);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(email));
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, IntegrationState>;
        setState({ ...seed(), ...saved });
        return;
      }
    } catch {
      /* ignore */
    }
    setState(seed());
  }, [email]);

  const persist = useCallback(
    (next: Record<string, IntegrationState>) => {
      setState(next);
      try {
        localStorage.setItem(KEY(email), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [email],
  );

  const stateOf = (key: string): IntegrationState =>
    state[key] ?? { connected: false, lastSyncAt: null };

  const connect = (key: string) =>
    persist({
      ...state,
      [key]: { ...stateOf(key), connected: true, lastSyncAt: new Date().toISOString() },
    });

  const disconnect = (key: string) =>
    persist({ ...state, [key]: { ...stateOf(key), connected: false, lastSyncAt: null } });

  // --- Sitio Web: gestión de dominios (fuente única) ---
  const siteConfig = (): SiteConfig => stateOf('web').config ?? emptySite();

  const writeSite = (config: SiteConfig) =>
    persist({
      ...state,
      web: {
        connected: config.domains.length > 0,
        lastSyncAt: config.domains.length > 0 ? new Date().toISOString() : null,
        config,
      },
    });

  const addDomain = (raw: string) => {
    const url = normalizeUrl(raw);
    if (!url) return;
    const cfg = siteConfig();
    if (cfg.domains.includes(url)) return;
    const domains = [...cfg.domains, url];
    writeSite({ domains, primary: cfg.primary ?? url });
  };

  const removeDomain = (url: string) => {
    const cfg = siteConfig();
    const domains = cfg.domains.filter((d) => d !== url);
    const primary = cfg.primary === url ? domains[0] ?? null : cfg.primary;
    writeSite({ domains, primary });
  };

  const setPrimaryDomain = (url: string) => {
    const cfg = siteConfig();
    if (!cfg.domains.includes(url)) return;
    writeSite({ ...cfg, primary: url });
  };

  const primarySiteUrl = (): string | null => siteConfig().primary;

  const connectedCount = useMemo(
    () => Object.values(state).filter((s) => s.connected).length,
    [state],
  );

  return {
    stateOf,
    connect,
    disconnect,
    siteConfig,
    addDomain,
    removeDomain,
    setPrimaryDomain,
    primarySiteUrl,
    connectedCount,
    total: INTEGRATIONS.length,
  };
};

/** Health-check REAL de alcance (solo integraciones `healthMode: 'real'`). */
export const useIntegrationHealth = (key: string, enabled: boolean) =>
  useQuery<IntegrationHealth>({
    queryKey: ['integration-health', key],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/integrations/${key}/health`);
      if (!res.ok) throw new Error('health-failed');
      return res.json();
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
