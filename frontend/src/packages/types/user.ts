/** Identity & access types. Architecture only — no auth is implemented in Sprint 0A. */

/** VERA roles. Modeled as a const object (not a TS enum) for `isolatedModules` safety. */
export const Role = {
  ADMIN: 'admin',
  BROKER: 'broker',
  ASESOR_COMERCIAL: 'asesor_comercial',
  MARKETING: 'marketing',
  PROPIETARIO: 'propietario',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.BROKER]: 'Broker',
  [Role.ASESOR_COMERCIAL]: 'Asesor Comercial',
  [Role.MARKETING]: 'Marketing',
  [Role.PROPIETARIO]: 'Propietario',
};

/** Fine-grained permission string, e.g. `properties:read`, `operations:write`. */
export type Permission = `${string}:${'read' | 'write' | 'delete' | 'manage'}`;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  avatarUrl?: string;
}
