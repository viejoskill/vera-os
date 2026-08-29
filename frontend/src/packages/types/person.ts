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
  | 'tasacion'
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

export const PERSON_ROLE_LABELS: Record<string, string> = {
  ...Object.fromEntries(PERSON_ROLES.map((r) => [r.id, r.label])),
  tasacion: 'Tasación',
};

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

/** Un HECHO de conocimiento estructurado (VERA Brain). Nunca texto libre. */
export interface PersonFact {
  id: string;
  personId: string;
  type: string;
  value: string | number;
  currency?: string | null;
  confidence: number;
  source: string;
  sourceRef?: string;
  firstDetected?: string;
  lastConfirmed?: string;
  status: 'active' | 'review' | 'superseded';
  hits?: number;
}

/** Lo que VERA SABE de una persona: conocimiento estructurado y acumulativo. */
export interface PersonKnowledge {
  personId: string;
  roles: PersonFact[];
  relationship: PersonFact[];
  interests: PersonFact[];
  preferences: PersonFact[];
  facts: PersonFact[];
  businessContext: PersonFact[];
  aiTags: PersonFact[];
  confidence: number;
  confidenceLabel: string;
  lastUpdated?: string | null;
  readable: string[];
  factCount: number;
  needsReview: PersonFact[];
}

/** Un filtro de negocio para la tabla: tipo de hecho + valor opcional. */
export interface PeopleTableFilter {
  type: string;
  value?: string;
}

/** Parámetros de la vista Tabla (base reutilizable para Audiencias). */
export interface PeopleTableParams {
  query?: string;
  facts?: PeopleTableFilter[];
  budgetMin?: number;
  budgetMax?: number;
  confidenceMin?: number;
  contactedWithin?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/** Fila enriquecida con conocimiento para la vista Tabla. */
export interface PersonTableRow {
  id: string;
  fullName: string;
  primaryPhone: string;
  primaryEmail: string;
  roles: string[];
  status: string;
  conversationsCount: number;
  lastContact?: string | null;
  interests: string[];
  budget?: number | null;
  budgetCurrency?: string | null;
  location: string;
  profession: string;
  relationship: string;
  intent: string;
  propertyType: string;
  confidence: number;
  confidenceLabel: string;
  [key: string]: unknown;
}

export interface PersonTableResponse {
  rows: PersonTableRow[];
  total: number;
  page: number;
  pageSize: number;
  columns: Record<string, string>;
  defaultColumns: string[];
}

/** Valores disponibles por filtro de negocio (para los selectores). */
export interface PeopleFacets {
  filters: Record<string, string>;
  values: Record<string, string[]>;
}

