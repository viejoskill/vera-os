import type { PeopleGateway } from '@vera/repositories';
import type { NewPersonInput, Person } from '@vera/types';

/**
 * PeopleService — dominio de Personas (base de la App Personas). Los propietarios
 * son el primer rol operativo. Reusable: sumar roles no cambia esta capa.
 */
export class PeopleService {
  constructor(private readonly gateway: PeopleGateway) {}

  list(role?: string): Promise<Person[]> {
    return this.gateway.list(role);
  }

  create(input: NewPersonInput): Promise<Person> {
    return this.gateway.create(input);
  }
}
