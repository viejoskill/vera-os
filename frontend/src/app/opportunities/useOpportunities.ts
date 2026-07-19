import { useQuery } from '@tanstack/react-query';
import { env } from '@vera/config';
import type { Opportunity } from './types';

/** Consume el Opportunity Engine (VERA Brain). La App sólo muestra; el motor
 * detecta y sugiere. Nunca envía nada automáticamente. */
export const useOpportunities = () =>
  useQuery<Opportunity[]>({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/opportunities`);
      if (!res.ok) throw new Error('opportunities-failed');
      return ((await res.json()) as { opportunities: Opportunity[] }).opportunities;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });
