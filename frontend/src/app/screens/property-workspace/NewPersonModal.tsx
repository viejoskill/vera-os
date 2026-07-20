import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Button, Input, Textarea } from '@vera/ui';
import { PERSON_ROLES, type Person } from '@vera/types';
import { useCreatePerson } from '@app/hooks/usePeople';

/**
 * Modal "Nueva persona". Crea una Persona real sin salir de la ficha, con uno o
 * varios roles (Propietario, Vendedor, Comprador, Inquilino, Contacto). Al guardar:
 * crea → el padre la asocia y sigue editando. VERA nunca obliga a abandonar la ficha.
 */
export const NewPersonModal = ({
  open,
  onClose,
  onCreated,
  title = 'Nueva persona',
  defaultRoles = ['propietario'],
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (person: Person) => void;
  title?: string;
  defaultRoles?: string[];
}) => {
  const create = useCreatePerson();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [roles, setRoles] = useState<string[]>(defaultRoles);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setRoles(defaultRoles);
      setError('');
      window.setTimeout(() => firstRef.current?.focus(), 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggleRole = (id: string) =>
    setRoles((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const submit = async () => {
    if (!fullName.trim()) {
      setError('Ingresá el nombre de la persona.');
      return;
    }
    if (roles.length === 0) {
      setError('Elegí al menos un rol.');
      return;
    }
    setError('');
    try {
      const person = await create.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
        roles,
      });
      onCreated(person);
      onClose();
    } catch {
      setError('No pudimos crear la persona. Reintentá en un momento.');
    }
  };

  return createPortal(
    <div className="vera-modal" role="dialog" aria-modal="true" data-testid="new-person-modal">
      <div className="vera-modal__backdrop" onClick={onClose} />
      <div className="vera-modal__panel">
        <header className="vera-modal__head">
          <span className="vera-modal__title">
            <UserPlus size={18} /> {title}
          </span>
          <button type="button" className="vera-modal__close" aria-label="Cerrar" data-testid="new-person-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="vera-modal__body vera-form">
          <Input
            ref={firstRef}
            label="Nombre completo"
            placeholder="Ej.: Sebastián Gómez"
            data-testid="new-person-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <div className="vera-form-grid">
            <Input
              label="Teléfono"
              placeholder="+54 11 5555-1234"
              data-testid="new-person-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="nombre@email.com"
              data-testid="new-person-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="vera-field">
            <span className="vera-field__label">Roles</span>
            <div className="vera-roles" role="group" aria-label="Roles de la persona">
              {PERSON_ROLES.map((r) => {
                const active = roles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`role-${r.id}`}
                    aria-pressed={active}
                    className={`vera-role-chip ${active ? 'vera-role-chip--active' : ''}`.trim()}
                    onClick={() => toggleRole(r.id)}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea
            label="Notas"
            rows={3}
            placeholder="Notas internas sobre la persona…"
            data-testid="new-person-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="vera-modal__error" data-testid="new-person-error">{error}</p>}
        </div>

        <footer className="vera-modal__foot">
          <Button variant="ghost" size="md" data-testid="new-person-cancel" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" disabled={create.isPending} data-testid="new-person-save" onClick={submit}>
            {create.isPending ? (<><Loader2 size={15} className="vera-spin" /> Guardando…</>) : 'Guardar persona'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
