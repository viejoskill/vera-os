import { useFormContext } from 'react-hook-form';
import { Check } from 'lucide-react';
import { Input, Select } from '@vera/ui';
import { PROPERTY_TYPE_OPTIONS, CURRENCY_OPTIONS, type PropertyFormValues } from './form-schema';
import { LocationSection } from './LocationSection';

// Visual-only thousands separator (es-AR uses "."). Internal value stays clean digits.
const formatThousands = (digits: string): string =>
  digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';

export const BasicInfoSection = () => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<PropertyFormValues>();
  const operation = watch('operation');
  const price = watch('price');
  const radar = watch('radar');

  return (
    <div className="vera-form">
      <div className="vera-field">
        <span className="vera-field__label">Operación</span>
        <div className="vera-segment" role="group" aria-label="Operación">
          {(['venta', 'alquiler'] as const).map((op) => (
            <button
              key={op}
              type="button"
              data-testid={`operation-${op}`}
              className={`vera-segment__btn ${operation === op ? 'vera-segment__btn--active' : ''}`.trim()}
              onClick={() => setValue('operation', op, { shouldValidate: true })}
            >
              {op === 'venta' ? 'Venta' : 'Alquiler'}
            </button>
          ))}
        </div>
      </div>

      <div className="vera-form-grid">
        <Select
          label="Tipo"
          options={PROPERTY_TYPE_OPTIONS}
          data-testid="select-type"
          {...register('type')}
        />
        <div className="vera-form-grid vera-form-grid--2-1">
          <Input
            label="Precio"
            inputMode="numeric"
            placeholder="Ej.: 189.000"
            data-testid="input-price"
            error={errors.price?.message}
            value={formatThousands(price)}
            onChange={(e) => {
              const clean = e.target.value.replace(/\D/g, '');
              setValue('price', clean, { shouldValidate: true, shouldDirty: true });
            }}
          />
          <Select label="Moneda" options={CURRENCY_OPTIONS} {...register('currency')} />
        </div>
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Radar</span>
        <button
          type="button"
          className={`vera-amenity ${radar ? 'vera-amenity--active' : ''}`.trim()}
          data-testid="toggle-radar"
          aria-pressed={radar}
          onClick={() => setValue('radar', !radar, { shouldDirty: true })}
        >
          <span className="vera-amenity__box">{radar && <Check size={13} />}</span>
          En Radar — destacada en la portada del sitio
        </button>
      </div>

      <LocationSection />
    </div>
  );
};
