import { useQuery } from '@tanstack/react-query';
import { intelligenceService } from '@vera/services';

/** Consumes the unified VERA Intelligence Engine output for the "Hoy" Inbox. */
export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => intelligenceService.analyze(),
  });
}
