/** Person (Persona) — base de la App Personas. Una Persona puede tener múltiples
 * roles a futuro (propietario, comprador, inquilino, contacto, escribano...). */
export type PersonRole =
  | 'propietario'
  | 'comprador'
  | 'vendedor'
  | 'inquilino'
  | 'contacto'
  | 'arquitecto'
  | 'escribano';

export interface Person {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  roles: string[];
  createdAt?: string;
}

export interface NewPersonInput {
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
  roles?: string[];
}
