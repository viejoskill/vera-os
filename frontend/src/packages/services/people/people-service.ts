import type { PeopleGateway } from '@vera/repositories';
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

  /** Lo que VERA SABE de la persona (conocimiento estructurado del Knowledge Engine). */
  knowledge(id: string): Promise<PersonKnowledge> {
    return this.gateway.knowledge(id);
  }

  /** Vista Tabla enriquecida con conocimiento + filtros de negocio (base Audiencias). */
  table(params: PeopleTableParams): Promise<PersonTableResponse> {
    return this.gateway.table(params);
  }

  /** Valores disponibles por filtro de negocio (selectores). */
  facets(): Promise<PeopleFacets> {
    return this.gateway.facets();
  }

  /** URL de descarga (CSV/Excel) respetando filtros, columnas y selección. */
  exportUrl(format: 'csv' | 'xlsx', params: PeopleTableParams, columns: string[], ids?: string[]): string {
    return this.gateway.exportUrl(format, params, columns, ids);
  }
}
