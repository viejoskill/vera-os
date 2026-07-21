import type { PeopleGateway } from '@vera/repositories';
import type {
  NewPersonInput,
  Person,
  PersonConversation,
  PersonEvent,
  PersonListItem,
  PersonPropertyRelation,
  PersonUpdateInput,
} from '@vera/types';

/**
 * PeopleService — dominio de Personas (VERA Core). Identidad única por `person_id`.
 * Sólo consulta/administra la entidad y muestra relaciones (sin lógica comercial).
 */
export class PeopleService {
  constructor(private readonly gateway: PeopleGateway) {}

  list(role?: string): Promise<PersonListItem[]> {
    return this.gateway.list(role);
  }

  get(id: string): Promise<Person> {
    return this.gateway.get(id);
  }

  create(input: NewPersonInput): Promise<Person> {
    return this.gateway.create(input);
  }

  update(id: string, patch: PersonUpdateInput): Promise<Person> {
    return this.gateway.update(id, patch);
  }

  relations(id: string): Promise<PersonPropertyRelation[]> {
    return this.gateway.relations(id);
  }

  conversations(id: string): Promise<PersonConversation[]> {
    return this.gateway.conversations(id);
  }

  timeline(id: string): Promise<PersonEvent[]> {
    return this.gateway.timeline(id);
  }
}
