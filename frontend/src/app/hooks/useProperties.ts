import { useQuery } from '@tanstack/react-query';
import { propertyService, type PropertyFilters } from '@vera/services';

/** Vertical slice: UI -> hook -> PropertyService -> Repository -> mock data. */
export function useProperties(filters: PropertyFilters = {}) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertyService.getProperties(filters),
  });
}
