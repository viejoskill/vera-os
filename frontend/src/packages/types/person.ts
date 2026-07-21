/** Person (Persona) — entidad de VERA Core. Identidad única referenciada por
 * `person_id` desde todos los módulos. Una Persona admite múltiples roles. */
export type PersonRole =
  | 'propietario'
  | 'comprador'
  | 'vendedor'
  | 'inquilino'
  | 'inversor'
  | 'proveedor'
  | 'contacto'
  | 'arquitecto'
  | 'escribano'
  | 'otro';

/** Roles operables desde la UI (App Personas). */
export const PERSON_ROLES: { id: PersonRole; label: string }[] = [
  { id: 'propietario', label: 'Propietario' },
  { id: 'comprador', label: 'Comprador' },
  { id: 'vendedor', label: 'Vendedor' },
  { id: 'inquilino', label: 'Inquilino' },
  { id: 'inversor', label: 'Inversor' },
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'arquitecto', label: 'Arquitecto' },
  { id: 'escribano', label: 'Escribano' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'otro', label: 'Otro' },
];

export const PERSON_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  PERSON_ROLES.map((r) => [r.id, r.label]),
);

export interface Person {
  id: string;
  fullName: string;
  primaryPhone: string;
  primaryEmail: string;
  phones: string[];
  emails: string[];
  document: string;
  notes: string;
  roles: string[];
  status: string;
  createdAt?: string;
}

export interface PersonListItem extends Person {
  propertiesCount: number;
  conversationsCount: number;
  lastContact?: string | null;
}

export interface NewPersonInput {
  fullName: string;
  primaryPhone?: string;
  primaryEmail?: string;
  phones?: string[];
  emails?: string[];
  document?: string;
  notes?: string;
  roles?: string[];
  status?: string;
}

export type PersonUpdateInput = Partial<Omit<Person, 'id' | 'createdAt'>>;

export interface PersonPropertyRelation {
  id: string;
  title: string;
  operation: string;
  status: string;
  city: string;
  price: number;
  currency: string;
  relation: string;
}

export interface PersonConversation {
  id: string;
  channel: string;
  propertyLabel: string;
  status: string;
  leadStatus: string;
  lastAt?: string | null;
  preview: string;
}

/** Evento tipado del timeline. La UI renderiza según `type` (no texto plano). */
export interface PersonEvent {
  id: string;
  type: string;
  meta: Record<string, unknown>;
  occurredAt?: string | null;
}
