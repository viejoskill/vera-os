import { useFormContext } from 'react-hook-form';
import { Sparkles, RefreshCw, Check } from 'lucide-react';
import { Textarea, Button } from '@vera/ui';
import { aiContentService } from '@vera/services';
import { useAiContent } from '@app/hooks/useAiContent';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';

/**
 * Descripción con VERA (mode=description). VERA PROPONE: genera una descripción a
 * partir de características + amenities; el profesional la aplica o pide otra.
 * Nunca sobrescribe el texto automáticamente.
 */
export const DescriptionSection = () => {
  const { register, watch, setValue } = useFormContext<PropertyFormValues>();
  const description = watch('description');
  const { status, data, run, reset } = useAiContent<string>();

  const generate = () => run(() => aiContentService.suggestDescription(buildAiContext(watch())));

  const apply = () => {
    if (data) setValue('description', data, { shouldDirty: true, shouldValidate: true });
    reset();
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
          disabled={status === 'loading'}
          onClick={generate}
        >
          <Sparkles size={15} /> {status === 'loading' ? 'VERA está escribiendo…' : 'Generar con VERA'}
        </Button>
      </div>

      {status === 'error' && (
        <p className="vera-muted" data-testid="description-error">
          VERA no pudo redactar la descripción ahora. Probá de nuevo en un momento.
        </p>
      )}

      {status === 'ready' && data && (
        <div className="vera-ai-preview" data-testid="description-suggestion">
          <span className="vera-field__label">
            <Sparkles size={13} /> Propuesta de VERA
          </span>
          <p className="vera-ai-preview__text">{data}</p>
          <div className="vera-ai-preview__actions">
            <Button type="button" variant="primary" size="sm" data-testid="use-description" onClick={apply}>
              <Check size={14} /> Usar esta descripción
            </Button>
            <button type="button" className="vera-ai-action" data-testid="regenerate-description" onClick={generate}>
              <RefreshCw size={13} /> Generar otra
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
