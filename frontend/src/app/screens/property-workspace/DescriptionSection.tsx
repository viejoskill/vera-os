import { useFormContext } from 'react-hook-form';
import { Sparkles } from 'lucide-react';
import { Textarea, Button } from '@vera/ui';
import { assistantService } from '@vera/services';
import type { PropertyFormValues } from './form-schema';

export const DescriptionSection = () => {
  const { register, getValues, setValue, watch } = useFormContext<PropertyFormValues>();
  const description = watch('description');

  const generate = () => {
    const text = assistantService.generateDescription(getValues());
    setValue('description', text, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="vera-form">
      <Textarea
        label="Descripción"
        rows={6}
        placeholder="Contá lo mejor de la propiedad… o dejá que VERA la redacte por vos."
        data-testid="input-description"
        {...register('description')}
      />
      <div className="vera-desc-footer">
        <span className="vera-muted">{description.trim().length} caracteres</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="generate-description"
          onClick={generate}
        >
          <Sparkles size={15} /> Generar con VERA
        </Button>
      </div>
    </div>
  );
};
