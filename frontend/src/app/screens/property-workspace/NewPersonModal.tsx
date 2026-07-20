import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { Button, Input, Textarea } from '@vera/ui';
import type { Person } from '@vera/types';
import { useCreatePerson } from '@app/hooks/usePeople';

/**
 * Modal "+ Nuevo propietario". Crea una Persona real (rol propietario) sin salir de
 * la ficha. Al guardar: crea → el padre la asocia y sigue editando. VERA nunca obliga
 * a abandonar la propiedad.
 */
export const NewPersonModal = ({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (person: Person) => void;
}) => {
  const create = useCreatePerson();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setError('');
      window.setTimeout(() => firstRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!fullName.trim()) {
      setError('Ingresá el nombre del propietario.');
      return;
    }
    setError('');
    try {
      const person = await create.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
        roles: ['propietario'],
      });
      onCreated(person);
      onClose();
    } catch {
      setError('No pudimos crear el propietario. Reintentá en un momento.');
    }
  };

  return createPortal(
    <div className="vera-modal" role="dialog" aria-modal="true" data-testid="new-person-modal">
      <div className="vera-modal__backdrop" onClick={onClose} />
      <div className="vera-modal__panel">
        <header className="vera-modal__head">
          <span className="vera-modal__title">
            <UserPlus size={18} /> Nuevo propietario
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
          <Textarea
            label="Notas"
            rows={3}
            placeholder="Notas internas sobre el propietario…"
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
            {create.isPending ? (<><Loader2 size={15} className="vera-spin" /> Guardando…</>) : 'Guardar propietario'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
