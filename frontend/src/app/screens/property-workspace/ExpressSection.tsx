import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Rocket, Copy, Check, RefreshCw, Pencil } from 'lucide-react';
import { Button, Textarea, Input } from '@vera/ui';
import { aiContentService } from '@vera/services';
import { useAiContent } from '@app/hooks/useAiContent';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';
import type { ExpressResult } from '@vera/repositories';

const composeAll = (r: ExpressResult): string => {
  const parts = [
    r.titles[0] ? `TÍTULO\n${r.titles[0]}` : '',
    r.description ? `DESCRIPCIÓN\n${r.description}` : '',
    r.highlights.length ? `DESTACADOS\n${r.highlights.map((h) => `• ${h}`).join('\n')}` : '',
    r.mercadolibre.title || r.mercadolibre.body
      ? `MERCADO LIBRE\n${r.mercadolibre.title}\n${r.mercadolibre.body}`
      : '',
    r.zonaprop.title || r.zonaprop.body
      ? `ZONAPROP\n${r.zonaprop.title}\n${r.zonaprop.body}`
      : '',
  ];
  return parts.filter(Boolean).join('\n\n');
};

/**
 * Publicación express (mode=express en backend): en un clic VERA arma título +
 * descripción + destacados + textos de Mercado Libre y Zonaprop, listos para copiar.
 * VERA propone; el profesional copia y decide. No sobrescribe la propiedad.
 */
export const ExpressSection = () => {
  const { watch, setValue, register } = useFormContext<PropertyFormValues>();
  const { status, data, run } = useAiContent<ExpressResult>();
  const [copied, setCopied] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const description = watch('description');

  // Cargar el resultado de la IA en campos editables (el usuario corrige antes de usar).
  useEffect(() => {
    if (data) {
      setEditTitle(data.titles[0] ?? '');
      setEditDesc(data.description ?? '');
    }
  }, [data]);

  const generate = () => run(() => aiContentService.generateExpress(buildAiContext(watch())));

  const applyTitle = (t: string) => setValue('title', t, { shouldDirty: true, shouldValidate: true });
  const applyDescription = (d: string) => {
    setValue('description', d.trim(), { shouldDirty: true, shouldValidate: true });
    setShowManual(true);
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

  const label = (key: string, text: string, testid: string) => (
    <button type="button" className="vera-ai-action" data-testid={testid} onClick={() => copy(key, text)}>
      {copied === key ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
    </button>
  );

  return (
    <div className="vera-form">
      <Input
        label="Título de la propiedad"
        placeholder="Escribí el título o generalo con VERA…"
        data-testid="manual-title"
        {...register('title')}
      />

      {status === 'idle' && (
        <p className="vera-muted">
          En un clic, VERA arma toda la publicación: título, descripción, destacados y los textos
          para Mercado Libre y Zonaprop.
        </p>
      )}

      {status !== 'ready' && (
        <Button
          type="button"
          variant="primary"
          size="md"
          data-testid="generate-express"
          disabled={status === 'loading'}
          onClick={generate}
        >
          <Rocket size={16} /> {status === 'loading' ? 'VERA está armando la publicación…' : 'Generar publicación completa'}
        </Button>
      )}

      {status === 'error' && (
        <p className="vera-muted" data-testid="express-error">
          VERA no pudo armar la publicación ahora. Probá de nuevo en un momento.
        </p>
      )}

      {status === 'ready' && data && (
        <div className="vera-ai-preview" data-testid="express-result">
          <div className="vera-ai-preview__actions">
            <Button type="button" variant="primary" size="sm" data-testid="copy-express-all" onClick={() => copy('all', composeAll({ ...data, titles: [editTitle, ...data.titles.slice(1)], description: editDesc }))}>
              {copied === 'all' ? <><Check size={14} /> Copiado todo</> : <><Copy size={14} /> Copiar todo</>}
            </Button>
            <button type="button" className="vera-ai-action" data-testid="regenerate-express" onClick={generate}>
              <RefreshCw size={13} /> Generar otra vez
            </button>
          </div>

          <div className="vera-portal-block">
            <div className="vera-portal-block__head">
              <span className="vera-field__label">Título</span>
              <div className="vera-express__block-actions">
                <button type="button" className="vera-ai-action" data-testid="use-express-title" onClick={() => applyTitle(editTitle)}>
                  <Check size={13} /> Usar
                </button>
                {label('title', editTitle, 'copy-express-title')}
              </div>
            </div>
            <input
              className="vera-express__edit-title"
              data-testid="express-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título de la publicación…"
            />
          </div>

          <div className="vera-portal-block">
            <div className="vera-portal-block__head">
              <span className="vera-field__label">Descripción</span>
              <div className="vera-express__block-actions">
                <button type="button" className="vera-ai-action" data-testid="use-express-description" onClick={() => applyDescription(editDesc)}>
                  <Check size={13} /> Usar
                </button>
                {label('desc', editDesc, 'copy-express-description')}
              </div>
            </div>
            <textarea
              className="vera-express__edit-desc"
              data-testid="express-description"
              value={editDesc}
              rows={12}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descripción de la publicación…"
            />
            <span className="vera-muted vera-express__hint">
              Corregí lo que la IA no sepa (ubicación, detalles) y después tocá “Usar”. VERA propone; vos decidís.
            </span>
          </div>

          {data.highlights.length > 0 && (
            <div className="vera-portal-block">
              <div className="vera-portal-block__head">
                <span className="vera-field__label">Destacados</span>
                {label('hl', data.highlights.map((h) => `• ${h}`).join('\n'), 'copy-express-highlights')}
              </div>
              <ul className="vera-highlights" data-testid="express-highlights">
                {data.highlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </div>
          )}

          {(data.mercadolibre.title || data.mercadolibre.body) && (
            <div className="vera-portal-block">
              <div className="vera-portal-block__head">
                <span className="vera-field__label">Mercado Libre</span>
                {label('ml', `${data.mercadolibre.title}\n${data.mercadolibre.body}`, 'copy-express-ml')}
              </div>
              <p className="vera-portal-block__title" data-testid="express-ml-title">{data.mercadolibre.title}</p>
              <p className="vera-portal-block__body" data-testid="express-ml-body">{data.mercadolibre.body}</p>
            </div>
          )}

          {(data.zonaprop.title || data.zonaprop.body) && (
            <div className="vera-portal-block">
              <div className="vera-portal-block__head">
                <span className="vera-field__label">Zonaprop</span>
                {label('zp', `${data.zonaprop.title}\n${data.zonaprop.body}`, 'copy-express-zp')}
              </div>
              <p className="vera-portal-block__title" data-testid="express-zp-title">{data.zonaprop.title}</p>
              <p className="vera-portal-block__body" data-testid="express-zp-body">{data.zonaprop.body}</p>
            </div>
          )}
        </div>
      )}

      <div className="vera-manual-desc">
        <button
          type="button"
          className="vera-ai-action"
          data-testid="toggle-manual-description"
          onClick={() => setShowManual((s) => !s)}
        >
          <Pencil size={13} /> {showManual ? 'Ocultar descripción' : 'Editar descripción a mano'}
        </button>
        {showManual && (
          <div className="vera-manual-desc__body">
            <Textarea
              label="Descripción de la propiedad"
              rows={6}
              placeholder="Escribí o ajustá la descripción…"
              data-testid="manual-description"
              {...register('description')}
            />
            <span className="vera-muted">{description.trim().length} caracteres</span>
          </div>
        )}
      </div>
    </div>
  );
};
