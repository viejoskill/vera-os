import { useFormContext } from 'react-hook-form';
import { Input, Select } from '@vera/ui';
import {
  CONDITION_OPTIONS,
  ORIENTATION_OPTIONS,
  FLOOR_TYPES,
  type PropertyFormValues,
} from './form-schema';

const CURRENT_YEAR = new Date().getFullYear();

/** Antigüedad derivada del año de construcción (única fuente de verdad). */
const ageLabel = (yearBuilt: string): string | null => {
  const year = Number((yearBuilt || '').trim());
  if (!year || year < 1800 || year > CURRENT_YEAR) return null;
  const age = CURRENT_YEAR - year;
  return age <= 0 ? 'A estrenar' : `Antigüedad: ${age} año${age === 1 ? '' : 's'}`;
};

/**
 * Características OBJETIVAS de la propiedad (base de conocimiento técnico).
 * Distinto de Amenities (atributos). Fuente única de verdad para IA, portales,
 * tasaciones y búsquedas.
 */
export const FeaturesSection = () => {
  const { register, watch } = useFormContext<PropertyFormValues>();
  const type = watch('type');
  const yearBuilt = watch('yearBuilt');
  const showFloor = FLOOR_TYPES.includes(type);
  const age = ageLabel(yearBuilt);

  return (
    <div className="vera-form">
      <div className="vera-field">
        <span className="vera-field__label">Ambientes</span>
        <div className="vera-form-grid vera-form-grid--4">
          <Input label="Ambientes" inputMode="numeric" placeholder="Ej.: 3" data-testid="input-rooms" {...register('rooms')} />
          <Input label="Dormitorios" inputMode="numeric" placeholder="Ej.: 2" data-testid="input-bedrooms" {...register('bedrooms')} />
          <Input label="Baños" inputMode="numeric" placeholder="Ej.: 1" data-testid="input-bathrooms" {...register('bathrooms')} />
          <Input label="Toilettes" inputMode="numeric" placeholder="Ej.: 1" data-testid="input-toilettes" {...register('toilettes')} />
        </div>
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Superficies (m²)</span>
        <div className="vera-form-grid vera-form-grid--3">
          <Input label="Cubierta" inputMode="numeric" placeholder="Ej.: 68" data-testid="input-area" {...register('areaM2')} />
          <Input label="Semicubierta" inputMode="numeric" placeholder="Ej.: 12" data-testid="input-semicovered" {...register('semiCoveredAreaM2')} />
          <Input label="Lote / Terreno" inputMode="numeric" placeholder="Ej.: 300" data-testid="input-lot" {...register('lotAreaM2')} />
        </div>
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Cocheras</span>
        <div className="vera-form-grid">
          <Input label="Cubiertas" inputMode="numeric" placeholder="Ej.: 1" data-testid="input-parking-covered" {...register('parkingCovered')} />
          <Input label="Descubiertas" inputMode="numeric" placeholder="Ej.: 1" data-testid="input-parking-uncovered" {...register('parkingUncovered')} />
        </div>
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Distribución y estado</span>
        <div className={`vera-form-grid ${showFloor ? 'vera-form-grid--3' : ''}`.trim()}>
          <Input label="Plantas" inputMode="numeric" placeholder="Ej.: 2" data-testid="input-floors" {...register('floors')} />
          {showFloor && (
            <Input label="Piso" inputMode="numeric" placeholder="Ej.: 4" data-testid="input-floor-number" {...register('floorNumber')} />
          )}
          <Select label="Estado de conservación" options={CONDITION_OPTIONS} data-testid="select-condition" {...register('condition')} />
        </div>
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Contexto</span>
        <div className="vera-form-grid vera-form-grid--3">
          <Select label="Orientación" options={ORIENTATION_OPTIONS} data-testid="select-orientation" {...register('orientation')} />
          <div>
            <Input
              label="Año de construcción"
              inputMode="numeric"
              placeholder="Ej.: 2018"
              data-testid="input-year"
              {...register('yearBuilt')}
            />
            {age && (
              <span className="vera-field__hint" data-testid="age-hint">
                {age}
              </span>
            )}
          </div>
          <Input label="Video / Reel de Instagram (link)" placeholder="https://www.instagram.com/reel/…" data-testid="input-video" {...register('videoUrl')} />
        </div>
      </div>
    </div>
  );
};
