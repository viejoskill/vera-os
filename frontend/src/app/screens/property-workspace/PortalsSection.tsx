import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@vera/ui';
import { aiContentService } from '@vera/services';
import { useAiContent } from '@app/hooks/useAiContent';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';
import type { PortalId } from '@vera/repositories';

const PORTALS: { id: PortalId; label: string }[] = [
  { id: 'mercadolibre', label: 'Mercado Libre' },
  { id: 'zonaprop', label: 'Zonaprop' },
];

type PortalResult = { title: string; body: string };

/**
 * Texto para portales (mode=portal). Adapta título + descripción al formato de
 * Mercado Libre / Zonaprop, listo para copiar. VERA propone; el usuario copia y usa.
 */
export const PortalsSection = () => {
  const { watch } = useFormContext<PropertyFormValues>();
  const [portal, setPortal] = useState<PortalId>('mercadolibre');
  const { status, data, run } = useAiContent<PortalResult>();
  const [copied, setCopied] = useState<string | null>(null);

  const generate = (p: PortalId) => {
    setPortal(p);
    run(() => aiContentService.adaptForPortal(buildAiContext(watch()), p));
  };

  const copy = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="vera-form">
      <div className="vera-field">
        <span className="vera-field__label">Portal</span>
        <div className="vera-segment" role="group" aria-label="Portal">
          {PORTALS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`portal-${p.id}`}
              className={`vera-segment__btn ${portal === p.id ? 'vera-segment__btn--active' : ''}`.trim()}
              onClick={() => setPortal(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="md"
        data-testid="generate-portal"
        disabled={status === 'loading'}
        onClick={() => generate(portal)}
      >
        <Sparkles size={15} />{' '}
        {status === 'loading' ? 'VERA está adaptando…' : `Generar texto para ${PORTALS.find((p) => p.id === portal)?.label}`}
      </Button>

      {status === 'error' && (
        <p className="vera-muted" data-testid="portal-error">
          VERA no pudo adaptar el texto ahora. Probá de nuevo.
        </p>
      )}

      {status === 'ready' && data && (
        <div className="vera-ai-preview" data-testid="portal-result">
          {data.title && (
            <div className="vera-portal-block">
              <div className="vera-portal-block__head">
                <span className="vera-field__label">Título</span>
                <button type="button" className="vera-ai-action" data-testid="copy-portal-title" onClick={() => copy('title', data.title)}>
                  {copied === 'title' ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
              <p className="vera-portal-block__title" data-testid="portal-title-text">{data.title}</p>
            </div>
          )}
          <div className="vera-portal-block">
            <div className="vera-portal-block__head">
              <span className="vera-field__label">Descripción</span>
              <button type="button" className="vera-ai-action" data-testid="copy-portal-body" onClick={() => copy('body', data.body)}>
                {copied === 'body' ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
            <p className="vera-portal-block__body" data-testid="portal-body-text">{data.body}</p>
          </div>
        </div>
      )}
    </div>
  );
};
