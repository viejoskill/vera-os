import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useTitleSuggestions } from '@app/hooks/useTitleSuggestions';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';

/**
 * Discrete VERA helper under the title field. VERA PROPONE, el profesional decide:
 * shows up to 3 SEO title options; applying one is always the user's choice.
 */
export const TitleSuggestions = () => {
  const { watch, setValue } = useFormContext<PropertyFormValues>();
  const [open, setOpen] = useState(false);
  const { status, suggestions, generate, reset } = useTitleSuggestions();

  const run = () => generate(buildAiContext(watch()));

  const handleToggle = () => {
    if (!open) {
      setOpen(true);
      run();
    } else {
      setOpen(false);
      reset();
    }
  };

  const apply = (title: string) => {
    setValue('title', title, { shouldDirty: true, shouldValidate: true });
    setOpen(false);
    reset();
  };

  return (
    <div className="vera-title-ai">
      <button
        type="button"
        className="vera-ai-action"
        data-testid="suggest-title"
        onClick={handleToggle}
      >
        <Sparkles size={14} />
        {open ? 'Cerrar sugerencias' : 'VERA sugiere un título'}
      </button>

      {open && (
        <div className="vera-title-ai__panel" data-testid="title-suggestions">
          {status === 'loading' && (
            <p className="vera-title-ai__state" data-testid="title-loading">
              VERA está pensando 3 opciones…
            </p>
          )}

          {status === 'error' && (
            <div className="vera-title-ai__state">
              <p className="vera-muted">VERA no pudo sugerir títulos ahora.</p>
              <button type="button" className="vera-ai-action" data-testid="title-retry" onClick={run}>
                <RefreshCw size={13} /> Probar de nuevo
              </button>
            </div>
          )}

          {status === 'ready' && (
            <>
              <ul className="vera-title-ai__list">
                {suggestions.map((title, i) => (
                  <li key={title} className="vera-title-ai__item" data-testid={`title-option-${i}`}>
                    <span className="vera-title-ai__text">{title}</span>
                    <button
                      type="button"
                      className="vera-ai-use"
                      data-testid={`use-title-${i}`}
                      onClick={() => apply(title)}
                    >
                      Usar este título
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="vera-ai-action" data-testid="title-regenerate" onClick={run}>
                <RefreshCw size={13} /> Generar otras
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
