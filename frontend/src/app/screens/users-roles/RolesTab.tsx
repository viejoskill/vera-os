import { useCallback, useEffect, useState } from 'react';
import { ShieldPlus, Copy, Pencil, Trash2, Lock } from 'lucide-react';
import { Button, Badge } from '@vera/ui';
import { rolesApi, type RoleSummary } from './api';
import { RoleFormModal } from './RoleFormModal';

export const RolesTab = () => {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRoles(await rolesApi.list());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const duplicate = async (id: string) => {
    await rolesApi.duplicate(id);
    await load();
  };

  const remove = async (role: RoleSummary) => {
    if (!window.confirm(`¿Borrar el rol "${role.name}"?`)) return;
    try {
      await rolesApi.remove(role.id);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No pudimos borrar el rol.');
    }
  };

  return (
    <div data-testid="roles-tab">
      <div className="vera-team__toolbar">
        <Button
          variant="primary"
          size="sm"
          data-testid="role-create-button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <ShieldPlus size={14} /> Nuevo rol
        </Button>
      </div>

      {loading ? (
        <p className="vera-team__empty">Cargando…</p>
      ) : (
        <section className="vera-team__section">
          {roles.map((r) => (
            <div key={r.id} className="vera-team__row" data-testid={`role-row-${r.id}`}>
              <span className="vera-team__email">
                {r.name}
                {r.isSystem && <Badge tone="default"><Lock size={11} /> Fijo</Badge>}
                <Badge tone="muted" data-testid={`role-usercount-${r.id}`}>{r.userCount} usuario(s)</Badge>
              </span>
              <div className="vera-team__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={r.isSystem}
                  data-testid={`role-edit-${r.id}`}
                  onClick={() => {
                    setEditing(r);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={14} /> Editar
                </Button>
                <Button variant="ghost" size="sm" data-testid={`role-duplicate-${r.id}`} onClick={() => duplicate(r.id)}>
                  <Copy size={14} /> Duplicar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={r.isSystem || r.userCount > 0}
                  data-testid={`role-delete-${r.id}`}
                  onClick={() => remove(r)}
                >
                  <Trash2 size={14} /> Borrar
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <RoleFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} editing={editing} />
    </div>
  );
};
