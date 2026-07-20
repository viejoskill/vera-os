import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peopleService } from '@vera/services';
import type { NewPersonInput } from '@vera/types';

/** Propietarios (Personas con rol propietario). Se refresca solo tras crear. */
export function useOwners() {
  return useQuery({
    queryKey: ['people', 'propietario'],
    queryFn: () => peopleService.list('propietario'),
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPersonInput) => peopleService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });
}
