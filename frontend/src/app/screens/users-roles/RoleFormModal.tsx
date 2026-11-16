import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Loader2 } from 'lucide-react';
import { Button, Input } from '@vera/ui';
import { navRoutes } from '@app/navigation';
import { rolesApi, type RoleSummary } from './api';

const ACTIONS: { id: string; label: string }[] = [
  { id: 'ver', label: 'Ver' },
  { id: 'crear', label: 'Crear' },
  { id: 'editar', label: 'Editar' },
  { id: 'borrar', label: 'Borrar' },
  { id: 'exportar', label: 'Exportar' },
];

const MODULES = navRoutes.map((r) => ({ id: r.id, label: r.label }));

export const RoleFormModal = ({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: RoleSummary | null;
}) => {
  const isEdit = Boolean(editing);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setPermissions(editing?.permissions ?? {});
    setError('');
    window.setTimeout(() => firstRef.current?.focus(), 60);
  }, [open, editing]);

  if (!open) return null;

  const toggle = (moduleId: string, action: string) => {
    setPermissions((prev) => {
      const current = prev[moduleId] ?? [];
      const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
      return { ...prev, [moduleId]: next };
    });
  };

  const submit = async () => {
    if (!name.trim()) return setError('Ingresá el nombre del rol.');
    setError('');
    setSaving(true);
    try {
      const cleanPermissions = Object.fromEntries(
        Object.entries(permissions).filter(([, actions]) => actions.length > 0),
      );
      if (isEdit && editing) {
        await rolesApi.update(editing.id, { name: name.trim(), permissions: cleanPermissions });
      } else {
        await rolesApi.create({ name: name.trim(), permissions: cleanPermissions });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="vera-modal" role="dialog" aria-modal="true" data-testid="role-form-modal">
      <div className="vera-modal__backdrop" onClick={onClose} />
      <div className="vera-modal__panel vera-modal__panel--wide">
        <header className="vera-modal__head">
          <span className="vera-modal__title"><Shield size={18} /> {isEdit ? 'Editar rol' : 'Nuevo rol'}</span>
          <button type="button" className="vera-modal__close" aria-label="Cerrar" data-testid="role-form-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="vera-modal__body vera-form">
          <Input
            ref={firstRef}
            label="Nombre del rol"
            placeholder="Ej.: Vendedor"
            data-testid="role-form-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="vera-permmatrix" data-testid="role-form-matrix">
            <div className="vera-permmatrix__row vera-permmatrix__row--head">
              <span>Módulo</span>
              {ACTIONS.map((a) => (
                <span key={a.id}>{a.label}</span>
              ))}
            </div>
            {MODULES.map((m) => (
              <div className="vera-permmatrix__row" key={m.id} data-testid={`role-form-module-${m.id}`}>
                <span className="vera-permmatrix__module">{m.label}</span>
                {ACTIONS.map((a) => (
                  <label key={a.id} className="vera-permmatrix__cell">
                    <input
                      type="checkbox"
                      checked={(permissions[m.id] ?? []).includes(a.id)}
                      data-testid={`role-form-perm-${m.id}-${a.id}`}
                      onChange={() => toggle(m.id, a.id)}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
          {error && <p className="vera-modal__error" data-testid="role-form-error">{error}</p>}
        </div>
        <footer className="vera-modal__foot">
          <Button variant="ghost" size="md" data-testid="role-form-cancel" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" disabled={saving} data-testid="role-form-save" onClick={submit}>
            {saving ? (<><Loader2 size={15} className="vera-spin" /> Guardando…</>) : 'Guardar rol'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
