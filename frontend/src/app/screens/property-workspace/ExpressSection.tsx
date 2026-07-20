import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Rocket, Copy, Check, RefreshCw, Pencil, Loader2 } from 'lucide-react';
import { Button, Textarea, Input } from '@vera/ui';
import { aiContentService } from '@vera/services';
import { useAiContent } from '@app/hooks/useAiContent';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';
import type { ExpressResult, PortalText } from '@vera/repositories';
import type { Property } from '@vera/types';

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

const EMPTY: PortalText = { title: '', body: '' };

/**
 * Contenido comercial: VERA arma título + descripción + destacados + textos de Mercado
 * Libre y Zonaprop. Todo es EDITABLE (el profesional corrige lo que la IA no sabe) y se
 * puede regenerar por bloque. VERA propone; el profesional decide. `persist` (solo en
 * propiedades existentes) guarda el cambio al usar, sin pasar por "Guardar".
 */
export const ExpressSection = ({
  persist,
}: {
  persist?: (patch: Partial<Property>) => Promise<void>;
}) => {
  const { watch, setValue, register } = useFormContext<PropertyFormValues>();
  const { status, data, run } = useAiContent<ExpressResult>();
  const [copied, setCopied] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMl, setEditMl] = useState<PortalText>(EMPTY);
  const [editZp, setEditZp] = useState<PortalText>(EMPTY);
  const [blockBusy, setBlockBusy] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const description = watch('description');

  // Cargar el resultado de la IA en campos editables (el usuario corrige antes de usar).
  useEffect(() => {
    if (data) {
      setEditTitle(data.titles[0] ?? '');
      setEditDesc(data.description ?? '');
      setEditMl(data.mercadolibre ?? EMPTY);
      setEditZp(data.zonaprop ?? EMPTY);
    }
  }, [data]);

  const ctx = () => buildAiContext(watch());
  const generate = () => run(() => aiContentService.generateExpress(ctx()));

  const flashSaved = (key: string) => {
    setSavedKey(key);
    window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2200);
  };

  const applyTitle = async (t: string) => {
    setValue('title', t, { shouldDirty: true, shouldValidate: true });
    if (persist) {
      await persist({ title: t });
      flashSaved('title');
    }
  };
  const applyDescription = async (d: string) => {
    setValue('description', d.trim(), { shouldDirty: true, shouldValidate: true });
    setShowManual(true);
    if (persist) {
      await persist({ description: d.trim() });
      flashSaved('desc');
    }
  };

  const regenTitle = async () => {
    setBlockBusy('title');
    try {
      const s = await aiContentService.suggestTitles(ctx());
      if (s[0]) setEditTitle(s[0]);
    } finally {
      setBlockBusy(null);
    }
  };
  const regenDesc = async () => {
    setBlockBusy('desc');
    try {
      const d = await aiContentService.suggestDescription(ctx());
      if (d) setEditDesc(d);
    } finally {
      setBlockBusy(null);
    }
  };
  const regenPortal = async (portal: 'mercadolibre' | 'zonaprop') => {
    setBlockBusy(portal);
    try {
      const r = await aiContentService.adaptForPortal(
        { ...ctx(), title: editTitle, description: editDesc },
        portal,
      );
      if (portal === 'mercadolibre') setEditMl(r);
      else setEditZp(r);
    } finally {
      setBlockBusy(null);
    }
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

  const regenBtn = (key: string, onClick: () => void, testid: string) => (
    <button type="button" className="vera-ai-action" data-testid={testid} disabled={blockBusy !== null} onClick={onClick}>
      {blockBusy === key ? <Loader2 size={13} className="vera-spin" /> : <RefreshCw size={13} />} Generar otro
    </button>
  );

  const useLabel = persist ? 'Usar y guardar' : 'Usar';

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
            <Button
              type="button"
              variant="primary"
              size="sm"
              data-testid="copy-express-all"
              onClick={() =>
                copy(
                  'all',
                  composeAll({
                    titles: [editTitle],
                    description: editDesc,
                    highlights: data.highlights,
                    mercadolibre: editMl,
                    zonaprop: editZp,
                  }),
                )
              }
            >
              {copied === 'all' ? <><Check size={14} /> Copiado todo</> : <><Copy size={14} /> Copiar todo</>}
            </Button>
            <button type="button" className="vera-ai-action" data-testid="regenerate-express" onClick={generate}>
              <RefreshCw size={13} /> Generar todo otra vez
            </button>
          </div>

          <div className="vera-portal-block">
            <div className="vera-portal-block__head">
              <span className="vera-field__label">Título</span>
              <div className="vera-express__block-actions">
                {regenBtn('title', regenTitle, 'regen-title')}
                <button type="button" className="vera-ai-action" data-testid="use-express-title" onClick={() => applyTitle(editTitle)}>
                  {savedKey === 'title' ? <><Check size={13} /> Guardado</> : <><Check size={13} /> {useLabel}</>}
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
                {regenBtn('desc', regenDesc, 'regen-description')}
                <button type="button" className="vera-ai-action" data-testid="use-express-description" onClick={() => applyDescription(editDesc)}>
                  {savedKey === 'desc' ? <><Check size={13} /> Guardado</> : <><Check size={13} /> {useLabel}</>}
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
              Corregí lo que la IA no sepa (ubicación, detalles) y después tocá “{useLabel}”. VERA propone; vos decidís.
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

          <div className="vera-portal-block">
            <div className="vera-portal-block__head">
              <span className="vera-field__label">Mercado Libre</span>
              <div className="vera-express__block-actions">
                {regenBtn('mercadolibre', () => regenPortal('mercadolibre'), 'regen-ml')}
                {label('ml', `${editMl.title}\n${editMl.body}`, 'copy-express-ml')}
              </div>
            </div>
            <input
              className="vera-express__edit-title"
              data-testid="express-ml-title"
              value={editMl.title}
              onChange={(e) => setEditMl((m) => ({ ...m, title: e.target.value }))}
              placeholder="Título para Mercado Libre…"
            />
            <textarea
              className="vera-express__edit-desc"
              data-testid="express-ml-body"
              value={editMl.body}
              rows={8}
              onChange={(e) => setEditMl((m) => ({ ...m, body: e.target.value }))}
              placeholder="Texto para Mercado Libre…"
            />
          </div>

          <div className="vera-portal-block">
            <div className="vera-portal-block__head">
              <span className="vera-field__label">Zonaprop</span>
              <div className="vera-express__block-actions">
                {regenBtn('zonaprop', () => regenPortal('zonaprop'), 'regen-zp')}
                {label('zp', `${editZp.title}\n${editZp.body}`, 'copy-express-zp')}
              </div>
            </div>
            <input
              className="vera-express__edit-title"
              data-testid="express-zp-title"
              value={editZp.title}
              onChange={(e) => setEditZp((m) => ({ ...m, title: e.target.value }))}
              placeholder="Título para Zonaprop…"
            />
            <textarea
              className="vera-express__edit-desc"
              data-testid="express-zp-body"
              value={editZp.body}
              rows={8}
              onChange={(e) => setEditZp((m) => ({ ...m, body: e.target.value }))}
              placeholder="Texto para Zonaprop…"
            />
          </div>
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
