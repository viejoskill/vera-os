import { useQuery } from '@tanstack/react-query';
import { propertyService } from '@vera/services';

/** Fetches a single property's full detail (data + images + documents). */
export function useProperty(id?: string) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyService.getProperty(id as string),
    enabled: !!id,
  });
}
