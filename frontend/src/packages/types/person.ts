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

/** Roles operables desde la UI (App Personas). El tipo `PersonRole` admite más. */
export const PERSON_ROLES: { id: PersonRole; label: string }[] = [
  { id: 'propietario', label: 'Propietario' },
  { id: 'vendedor', label: 'Vendedor' },
  { id: 'comprador', label: 'Comprador' },
  { id: 'inquilino', label: 'Inquilino' },
  { id: 'contacto', label: 'Contacto' },
];

export const PERSON_ROLE_LABELS: Record<string, string> = {
  propietario: 'Propietario',
  vendedor: 'Vendedor',
  comprador: 'Comprador',
  inquilino: 'Inquilino',
  contacto: 'Contacto',
  arquitecto: 'Arquitecto',
  escribano: 'Escribano',
};

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
