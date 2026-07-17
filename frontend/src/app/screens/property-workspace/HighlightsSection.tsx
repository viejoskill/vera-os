import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@vera/ui';
import { aiContentService } from '@vera/services';
import { useAiContent } from '@app/hooks/useAiContent';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';

/**
 * Destacados / Potencial (mode=highlights). VERA genera bullets de fortalezas
 * desde amenities + datos objetivos, para copiar. No se guardan (contenido derivado).
 */
export const HighlightsSection = () => {
  const { watch } = useFormContext<PropertyFormValues>();
  const { status, data, run } = useAiContent<string[]>();
  const [copied, setCopied] = useState(false);

  const generate = () => run(() => aiContentService.suggestHighlights(buildAiContext(watch())));

  const copyAll = async () => {
    if (!data?.length) return;
    try {
      await navigator.clipboard.writeText(data.map((h) => `• ${h}`).join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="vera-form">
      {status === 'idle' && (
        <p className="vera-muted">
          VERA arma los puntos fuertes de la propiedad a partir de sus características y amenities.
        </p>
      )}

      {status !== 'ready' && (
        <Button
          type="button"
          variant="secondary"
          size="md"
          data-testid="generate-highlights"
          disabled={status === 'loading'}
          onClick={generate}
        >
          <Sparkles size={15} /> {status === 'loading' ? 'VERA está pensando…' : 'Generar destacados'}
        </Button>
      )}

      {status === 'error' && (
        <p className="vera-muted" data-testid="highlights-error">
          VERA no pudo generar los destacados ahora. Probá de nuevo.
        </p>
      )}

      {status === 'ready' && data && (
        <div className="vera-ai-preview" data-testid="highlights-result">
          <span className="vera-field__label">
            <Sparkles size={13} /> Destacados sugeridos
          </span>
          <ul className="vera-highlights">
            {data.map((h, i) => (
              <li key={h} data-testid={`highlight-${i}`}>{h}</li>
            ))}
          </ul>
          <div className="vera-ai-preview__actions">
            <Button type="button" variant="primary" size="sm" data-testid="copy-highlights" onClick={copyAll}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar todos</>}
            </Button>
            <button type="button" className="vera-ai-action" data-testid="regenerate-highlights" onClick={generate}>
              <RefreshCw size={13} /> Generar otros
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
