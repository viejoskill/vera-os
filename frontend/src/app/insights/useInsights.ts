import { useQuery } from '@tanstack/react-query';
import { env } from '@vera/config';
import type { InsightsResponse } from './types';

/** Consume el Insights Engine (VERA Brain). Devuelve los insights + un resumen
 * de "qué encontró VERA" para el encabezado AI-First de Hoy. */
export const useInsights = () =>
  useQuery<InsightsResponse>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/insights`);
      if (!res.ok) throw new Error('insights-failed');
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
