import type {
  NewPersonInput,
  PeopleFacets,
  PeopleTableParams,
  Person,
  PersonConversation,
  PersonEvent,
  PersonKnowledge,
  PersonListItem,
  PersonPropertyRelation,
  PersonTableResponse,
  PersonUpdateInput,
} from '@vera/types';

/** Contrato de acceso a Personas. La capa de Servicios no conoce el transporte. */
export interface PeopleGateway {
  list(role?: string): Promise<PersonListItem[]>;
  get(id: string): Promise<Person>;
  create(input: NewPersonInput): Promise<Person>;
  update(id: string, patch: PersonUpdateInput): Promise<Person>;
  relations(id: string): Promise<PersonPropertyRelation[]>;
  conversations(id: string): Promise<PersonConversation[]>;
  timeline(id: string): Promise<PersonEvent[]>;
  knowledge(id: string): Promise<PersonKnowledge>;
  table(params: PeopleTableParams): Promise<PersonTableResponse>;
  facets(): Promise<PeopleFacets>;
  exportUrl(format: 'csv' | 'xlsx', params: PeopleTableParams, columns: string[], ids?: string[]): string;
}
