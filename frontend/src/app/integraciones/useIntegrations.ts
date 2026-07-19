import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { env } from '@vera/config';
import { useAuthUser } from '@app/auth/useAuthUser';
import { INTEGRATIONS } from './catalog';
import type { IntegrationHealth, IntegrationState } from './types';

const KEY = (email: string) => `vera:integrations:${email || 'anon'}`;

const seed = (): Record<string, IntegrationState> =>
  INTEGRATIONS.reduce<Record<string, IntegrationState>>((acc, i) => {
    acc[i.key] = {
      connected: Boolean(i.defaultConnected),
      lastSyncAt: i.defaultConnected ? new Date().toISOString() : null,
    };
    return acc;
  }, {});

/** Estado (simulado, persistido) de conexión de las integraciones. Pertenece al
 * usuario. Arturito viene conectado por defecto; su SALUD es real (backend). */
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

  const connect = (key: string) =>
    persist({ ...state, [key]: { connected: true, lastSyncAt: new Date().toISOString() } });

  const disconnect = (key: string) =>
    persist({ ...state, [key]: { connected: false, lastSyncAt: null } });

  const stateOf = (key: string): IntegrationState =>
    state[key] ?? { connected: false, lastSyncAt: null };

  const connectedCount = Object.values(state).filter((s) => s.connected).length;

  return { stateOf, connect, disconnect, connectedCount, total: INTEGRATIONS.length };
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
