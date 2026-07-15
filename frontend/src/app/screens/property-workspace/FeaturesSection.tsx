import { useFormContext } from 'react-hook-form';
import { Input } from '@vera/ui';
import { AMENITY_OPTIONS, type PropertyFormValues } from './form-schema';

export const FeaturesSection = () => {
  const { register, watch, setValue } = useFormContext<PropertyFormValues>();
  const amenities = watch('amenities');

  const toggle = (amenity: string) => {
    const next = amenities.includes(amenity)
      ? amenities.filter((a) => a !== amenity)
      : [...amenities, amenity];
    setValue('amenities', next, { shouldDirty: true });
  };

  return (
    <div className="vera-form">
      <div className="vera-form-grid vera-form-grid--3">
        <Input label="Dormitorios" inputMode="numeric" placeholder="2" {...register('bedrooms')} />
        <Input label="Baños" inputMode="numeric" placeholder="1" {...register('bathrooms')} />
        <Input label="Superficie (m²)" inputMode="numeric" placeholder="68" {...register('areaM2')} />
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Comodidades</span>
        <div className="vera-chips">
          {AMENITY_OPTIONS.map((amenity) => {
            const active = amenities.includes(amenity);
            return (
              <button
                key={amenity}
                type="button"
                data-testid={`amenity-${amenity}`}
                className={`vera-chip ${active ? 'vera-chip--active' : ''}`.trim()}
                onClick={() => toggle(amenity)}
              >
                {amenity}
              </button>
            );
          })}
        </div>
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Multimedia y detalles</span>
        <div className="vera-form-grid vera-form-grid--3">
          <Input
            label="Año de construcción"
            inputMode="numeric"
            placeholder="2018"
            data-testid="input-year"
            {...register('yearBuilt')}
          />
          <Input
            label="Video (link)"
            placeholder="https://youtube.com/…"
            data-testid="input-video"
            {...register('videoUrl')}
          />
          <Input
            label="Plano (link)"
            placeholder="Link al plano"
            data-testid="input-floorplan"
            {...register('floorPlanUrl')}
          />
        </div>
      </div>
    </div>
  );
};
