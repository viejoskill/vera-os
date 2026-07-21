import type {
  NewPersonInput,
  Person,
  PersonConversation,
  PersonEvent,
  PersonListItem,
  PersonPropertyRelation,
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
}
