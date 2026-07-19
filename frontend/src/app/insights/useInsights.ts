import { useQuery } from '@tanstack/react-query';
import { env } from '@vera/config';
import type { Insight } from './types';

/** Consume el Insights Engine (VERA Brain). La App sólo muestra; el motor detecta
 * hechos y propone acciones. Nunca ejecuta ni envía nada. */
export const useInsights = () =>
  useQuery<Insight[]>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/insights`);
      if (!res.ok) throw new Error('insights-failed');
      return ((await res.json()) as { insights: Insight[] }).insights;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
