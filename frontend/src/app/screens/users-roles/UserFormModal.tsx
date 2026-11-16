import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Button, Input } from '@vera/ui';
import { usersApi, type RoleSummary, type UserRow } from './api';
import { SecretReveal } from './SecretReveal';

export const UserFormModal = ({
  open,
  onClose,
  onSaved,
  roles,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  roles: RoleSummary[];
  editing?: UserRow | null;
}) => {
  const isEdit = Boolean(editing);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [inviteByEmail, setInviteByEmail] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<UserRow | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setEmail(editing?.email ?? '');
    setRoleIds(editing?.roleIds ?? []);
    setInviteByEmail(false);
    setError('');
    setCreated(null);
    window.setTimeout(() => firstRef.current?.focus(), 60);
  }, [open, editing]);

  if (!open) return null;

  const toggleRole = (id: string) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const submit = async () => {
    if (!name.trim()) return setError('Ingresá el nombre.');
    if (!isEdit && !email.trim()) return setError('Ingresá el email.');
    if (roleIds.length === 0) return setError('Elegí al menos un rol.');
    setError('');
    setSaving(true);
    try {
      if (isEdit && editing) {
        await usersApi.update(editing.email, { name: name.trim(), roleIds });
        onSaved();
        onClose();
      } else {
        const user = await usersApi.create({ name: name.trim(), email: email.trim(), roleIds, inviteByEmail });
        onSaved();
        if (user.temporaryPassword) {
          setCreated(user);
        } else {
          onClose();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="vera-modal" role="dialog" aria-modal="true" data-testid="user-form-modal">
      <div className="vera-modal__backdrop" onClick={created ? undefined : onClose} />
      <div className="vera-modal__panel">
        <header className="vera-modal__head">
          <span className="vera-modal__title">
            <UserPlus size={18} /> {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </span>
          {!created && (
            <button type="button" className="vera-modal__close" aria-label="Cerrar" data-testid="user-form-close" onClick={onClose}>
              <X size={18} />
            </button>
          )}
        </header>

        {created ? (
          <div className="vera-modal__body vera-form">
            <p>Usuario <strong>{created.email}</strong> creado. Contraseña temporal (deberá cambiarla al ingresar):</p>
            <SecretReveal label="Contraseña temporal" value={created.temporaryPassword ?? ''} />
          </div>
        ) : (
          <div className="vera-modal__body vera-form">
            <Input
              ref={firstRef}
              label="Nombre completo"
              placeholder="Ej.: María Pérez"
              data-testid="user-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="nombre@email.com"
              data-testid="user-form-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
            />
            <div className="vera-field">
              <span className="vera-field__label">Roles</span>
              <div className="vera-roles" role="group" aria-label="Roles del usuario">
                {roles.map((r) => {
                  const active = roleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-testid={`user-form-role-${r.id}`}
                      aria-pressed={active}
                      className={`vera-role-chip ${active ? 'vera-role-chip--active' : ''}`.trim()}
                      onClick={() => toggleRole(r.id)}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {!isEdit && (
              <div className="vera-field">
                <span className="vera-field__label">Cómo le damos el acceso</span>
                <label className="vera-radio-row">
                  <input type="radio" checked={!inviteByEmail} onChange={() => setInviteByEmail(false)} data-testid="user-form-temp-password" />
                  Contraseña temporal (se la pasás vos; debe cambiarla al ingresar)
                </label>
                <label className="vera-radio-row">
                  <input type="radio" checked={inviteByEmail} onChange={() => setInviteByEmail(true)} data-testid="user-form-invite-email" />
                  Invitación por email (Supabase le manda el link para que elija su clave)
                </label>
              </div>
            )}
            {error && <p className="vera-modal__error" data-testid="user-form-error">{error}</p>}
          </div>
        )}

        <footer className="vera-modal__foot">
          {created ? (
            <Button variant="primary" size="md" data-testid="user-form-done" onClick={onClose}>
              Listo
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="md" data-testid="user-form-cancel" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" size="md" disabled={saving} data-testid="user-form-save" onClick={submit}>
                {saving ? (<><Loader2 size={15} className="vera-spin" /> Guardando…</>) : 'Guardar'}
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
