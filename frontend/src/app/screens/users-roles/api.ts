import { env } from '@vera/config';

const BASE = `${env.backendUrl}/api`;

export interface RoleRef {
  id: string;
  name: string;
}

export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Record<string, string[]>;
  userCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserRow {
  email: string;
  name: string;
  roles: RoleRef[];
  roleIds: string[];
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  temporaryPassword?: string;
}

async function asJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Ocurrió un error');
  return data;
}

export const usersApi = {
  list: () => fetch(`${BASE}/users`).then(asJson).then((d) => d.users as UserRow[]),
  create: (body: { name: string; email: string; roleIds: string[]; inviteByEmail: boolean }) =>
    fetch(`${BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(asJson) as Promise<UserRow>,
  update: (email: string, body: { name?: string; roleIds?: string[] }) =>
    fetch(`${BASE}/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(asJson) as Promise<UserRow>,
  deactivate: (email: string) =>
    fetch(`${BASE}/users/${encodeURIComponent(email)}/deactivate`, { method: 'POST' }).then(asJson) as Promise<UserRow>,
  reactivate: (email: string) =>
    fetch(`${BASE}/users/${encodeURIComponent(email)}/reactivate`, { method: 'POST' }).then(asJson) as Promise<UserRow>,
  resetPassword: (email: string, method: 'temporary' | 'email') =>
    fetch(`${BASE}/users/${encodeURIComponent(email)}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    }).then(asJson) as Promise<{ ok: boolean; method: string; temporaryPassword?: string }>,
};

export const rolesApi = {
  list: () => fetch(`${BASE}/roles`).then(asJson).then((d) => d.roles as RoleSummary[]),
  create: (body: { name: string; permissions: Record<string, string[]> }) =>
    fetch(`${BASE}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(asJson) as Promise<RoleSummary>,
  update: (id: string, body: { name: string; permissions: Record<string, string[]> }) =>
    fetch(`${BASE}/roles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(asJson) as Promise<RoleSummary>,
  duplicate: (id: string) =>
    fetch(`${BASE}/roles/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }).then(asJson) as Promise<RoleSummary>,
  remove: (id: string) =>
    fetch(`${BASE}/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(asJson),
};
