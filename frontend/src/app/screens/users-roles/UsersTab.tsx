import { useCallback, useEffect, useState } from 'react';
import { UserPlus, UserCog, Ban, RotateCcw, KeyRound, Pencil } from 'lucide-react';
import { Button, Badge } from '@vera/ui';
import { usersApi, rolesApi, type UserRow, type RoleSummary } from './api';
import { UserFormModal } from './UserFormModal';
import { ResetPasswordModal } from './ResetPasswordModal';

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
};

export const UsersTab = ({ currentEmail }: { currentEmail: string }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, r] = await Promise.all([usersApi.list(), rolesApi.list()]);
    setUsers(u);
    setRoles(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (user: UserRow) => {
    if (user.active && !window.confirm(`¿Desactivar a ${user.name || user.email}? No va a poder ingresar hasta que lo reactives.`)) {
      return;
    }
    setBusy(user.email);
    try {
      if (user.active) await usersApi.deactivate(user.email);
      else await usersApi.reactivate(user.email);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No pudimos actualizar el usuario.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="users-tab">
      <div className="vera-team__toolbar">
        <Button
          variant="primary"
          size="sm"
          data-testid="user-create-button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <UserPlus size={14} /> Nuevo usuario
        </Button>
      </div>

      {loading ? (
        <p className="vera-team__empty">Cargando…</p>
      ) : (
        <section className="vera-team__section">
          {users.map((u) => (
            <div key={u.email} className="vera-team__row" data-testid={`user-row-${u.email}`}>
              <span className="vera-team__email">
                {u.name || u.email}
                <span className="vera-team__sub-email">{u.email}</span>
                {!u.active && <Badge tone="muted" data-testid={`user-status-${u.email}`}>Desactivado</Badge>}
                {u.mustChangePassword && <Badge tone="default">Clave pendiente</Badge>}
                {u.roles.map((r) => (
                  <Badge key={r.id} tone="primary" data-testid={`user-role-badge-${u.email}-${r.id}`}>
                    {r.id === 'administrador' && <UserCog size={11} />} {r.name}
                  </Badge>
                ))}
              </span>
              <span className="vera-team__meta">Último ingreso: {fmtDate(u.lastLoginAt)} · Creado: {fmtDate(u.createdAt)}</span>
              <div className="vera-team__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`user-edit-${u.email}`}
                  onClick={() => {
                    setEditing(u);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={14} /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`user-reset-password-${u.email}`}
                  onClick={() => setResetEmail(u.email)}
                >
                  <KeyRound size={14} /> Resetear clave
                </Button>
                {u.email !== currentEmail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === u.email}
                    data-testid={`user-toggle-active-${u.email}`}
                    onClick={() => toggleActive(u)}
                  >
                    {u.active ? (<><Ban size={14} /> Desactivar</>) : (<><RotateCcw size={14} /> Reactivar</>)}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        roles={roles}
        editing={editing}
      />
      <ResetPasswordModal
        open={Boolean(resetEmail)}
        onClose={() => setResetEmail(null)}
        email={resetEmail ?? ''}
      />
    </div>
  );
};
