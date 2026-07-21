import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peopleService } from '@vera/services';
import type { NewPersonInput, PeopleTableParams, PersonUpdateInput } from '@vera/types';

/** Propietarios (Personas con rol propietario). Se refresca solo tras crear. */
export function useOwners() {
  return useQuery({
    queryKey: ['people', 'propietario'],
    queryFn: () => peopleService.list('propietario'),
  });
}

/** Listado completo de Personas (enriquecido con métricas de relación). */
export function usePeople() {
  return useQuery({
    queryKey: ['people', 'all'],
    queryFn: () => peopleService.list(),
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: () => peopleService.get(id as string),
    enabled: !!id,
  });
}

export function usePersonRelations(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id, 'relations'],
    queryFn: () => peopleService.relations(id as string),
    enabled: !!id,
  });
}

export function usePersonConversations(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id, 'conversations'],
    queryFn: () => peopleService.conversations(id as string),
    enabled: !!id,
  });
}

export function usePersonTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id, 'timeline'],
    queryFn: () => peopleService.timeline(id as string),
    enabled: !!id,
  });
}

export function usePersonKnowledge(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id, 'knowledge'],
    queryFn: () => peopleService.knowledge(id as string),
    enabled: !!id,
  });
}

/** Vista Tabla (enriquecida + filtros de negocio). Reusable para Audiencias. */
export function usePeopleTable(params: PeopleTableParams) {
  return useQuery({
    queryKey: ['people', 'table', params],
    queryFn: () => peopleService.table(params),
    placeholderData: (prev) => prev,
  });
}

/** Valores disponibles por filtro de negocio (selectores). */
export function usePeopleFacets() {
  return useQuery({
    queryKey: ['people', 'facets'],
    queryFn: () => peopleService.facets(),
  });
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPersonInput) => peopleService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });
}

export function useUpdatePerson(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: PersonUpdateInput) => peopleService.update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['person', id] });
    },
  });
}
