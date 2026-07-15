import { useFormContext } from 'react-hook-form';
import { Mail, Phone, UserPlus } from 'lucide-react';
import { Select, Textarea } from '@vera/ui';
import { ownerService } from '@vera/services';
import type { PropertyFormValues } from './form-schema';

// Architecture note: OwnerService returns a list so a property can link multiple
// owners in the future. For now the workspace links a single owner.
const OWNER_OPTIONS = [
  { value: '', label: 'Seleccioná un propietario' },
  ...ownerService.listOwners().map((o) => ({ value: o.id, label: o.name })),
];

export const OwnerSection = () => {
  const { register, watch } = useFormContext<PropertyFormValues>();
  const ownerId = watch('ownerId');
  const owner = ownerId ? ownerService.getOwner(ownerId) : null;

  return (
    <div className="vera-form">
      <Select
        label="Propietario vinculado"
        options={OWNER_OPTIONS}
        data-testid="select-owner"
        {...register('ownerId')}
      />

      {owner ? (
        <div className="vera-owner__card" data-testid="owner-details">
          <span className="vera-owner__row">
            <Mail size={14} /> {owner.email}
          </span>
          <span className="vera-owner__row">
            <Phone size={14} /> {owner.phone}
          </span>
        </div>
      ) : (
        <div className="vera-nextstep vera-nextstep--soft" data-testid="owner-nextstep">
          <UserPlus size={15} />
          Vinculá al propietario para avanzar con la publicación.
        </div>
      )}

      <Textarea
        label="Observaciones"
        rows={3}
        placeholder="Notas internas sobre el propietario o la propiedad…"
        data-testid="input-owner-observations"
        {...register('ownerObservations')}
      />
    </div>
  );
};
