import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Mail, Phone, UserPlus, Plus } from 'lucide-react';
import { Select, Textarea } from '@vera/ui';
import { PERSON_ROLE_LABELS, type Person } from '@vera/types';
import { useOwners } from '@app/hooks/usePeople';
import { NewPersonModal } from './NewPersonModal';
import type { PropertyFormValues } from './form-schema';

/**
 * Propietario — primer rol de la App Personas. Selector de Personas (rol propietario)
 * + "Nuevo propietario" que crea la Persona real sin salir de la ficha y la asocia
 * automáticamente. El selector se refresca solo (react-query) sin recargar la página.
 */
export const OwnerSection = () => {
  const { register, watch, setValue } = useFormContext<PropertyFormValues>();
  const { data: owners = [], isLoading } = useOwners();
  const [modalOpen, setModalOpen] = useState(false);

  const ownerId = watch('ownerId');
  const owner = owners.find((o) => o.id === ownerId) ?? null;

  const options = [
    { value: '', label: isLoading ? 'Cargando propietarios…' : 'Seleccioná un propietario' },
    ...owners.map((o) => ({ value: o.id, label: o.fullName })),
  ];

  const onCreated = (person: Person) => {
    setValue('ownerId', person.id, { shouldDirty: true });
  };

  return (
    <div className="vera-form">
      <div className="vera-owner__select">
        <Select
          label="Propietario vinculado"
          options={options}
          data-testid="select-owner"
          {...register('ownerId')}
        />
        <button
          type="button"
          className="vera-owner__new"
          data-testid="new-owner-trigger"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={15} /> Nuevo propietario
        </button>
      </div>

      {owner ? (
        <div className="vera-owner__card" data-testid="owner-details">
          <strong className="vera-owner__name">{owner.fullName}</strong>
          {owner.phone && (
            <span className="vera-owner__row"><Phone size={14} /> {owner.phone}</span>
          )}
          {owner.email && (
            <span className="vera-owner__row"><Mail size={14} /> {owner.email}</span>
          )}
          {owner.roles?.length > 0 && (
            <div className="vera-role-tags" data-testid="owner-roles">
              {owner.roles.map((r) => (
                <span key={r} className="vera-role-tag">{PERSON_ROLE_LABELS[r] ?? r}</span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="vera-nextstep vera-nextstep--soft" data-testid="owner-nextstep">
          <UserPlus size={15} />
          Vinculá al propietario o creá uno nuevo sin salir de la ficha.
        </div>
      )}

      <Textarea
        label="Observaciones"
        rows={3}
        placeholder="Notas internas sobre el propietario o la propiedad…"
        data-testid="input-owner-observations"
        {...register('ownerObservations')}
      />

      <NewPersonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={onCreated}
        title="Nuevo propietario"
        defaultRoles={['propietario']}
      />
    </div>
  );
};
