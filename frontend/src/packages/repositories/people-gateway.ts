import type { NewPersonInput, Person } from '@vera/types';

/** Contrato de acceso a Personas. La capa de Servicios no conoce el transporte. */
export interface PeopleGateway {
  list(role?: string): Promise<Person[]>;
  create(input: NewPersonInput): Promise<Person>;
}
