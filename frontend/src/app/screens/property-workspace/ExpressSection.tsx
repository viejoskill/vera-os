import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Rocket, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@vera/ui';
import { aiContentService } from '@vera/services';
import { useAiContent } from '@app/hooks/useAiContent';
import { buildAiContext } from './ai-context';
import type { PropertyFormValues } from './form-schema';
import type { ExpressResult, PortalText } from '@vera/repositories';

const EMPTY: PortalText = { title: '', body: '' };

const composeAll = (r: {
  title: string;
  description: string;
  highlights: string[];
  mercadolibre: PortalText;
  zonaprop: PortalText;
}): string => {
  const parts = [
    r.title ? `TÍTULO\n${r.title}` : '',
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
 * Contenido comercial. Título y Descripción son campos del FORMULARIO: lo que se ve
 * es lo que se guarda con "Guardar" (a prueba de errores, sin paso "Usar"). VERA
 * propone (Generar) y el profesional corrige/decide. Los textos de portales (ML /
 * Zonaprop) son para copiar y NO se persisten.
 */
export const ExpressSection = () => {
  const { watch, setValue } = useFormContext<PropertyFormValues>();
  const { status, data, run } = useAiContent<ExpressResult>();
  const [copied, setCopied] = useState<string | null>(null);
  const [editMl, setEditMl] = useState<PortalText>(EMPTY);
  const [editZp, setEditZp] = useState<PortalText>(EMPTY);
  const [blockBusy, setBlockBusy] = useState<string | null>(null);

  const title = watch('title');
  const description = watch('description');

  useEffect(() => {
    if (data) {
      setEditMl(data.mercadolibre ?? EMPTY);
      setEditZp(data.zonaprop ?? EMPTY);
    }
  }, [data]);

  const ctx = () => buildAiContext(watch());
  const setTitle = (v: string) => setValue('title', v, { shouldDirty: true, shouldValidate: true });
  const setDesc = (v: string) => setValue('description', v, { shouldDirty: true, shouldValidate: true });

  // Generación completa: escribe título + descripción en el formulario y arma portales.
  const generate = () =>
    run(async () => {
      const r = await aiContentService.generateExpress(ctx());
      if (r.titles[0]) setTitle(r.titles[0]);
      if (r.description) setDesc(r.description);
      return r;
    });

  const regenTitle = async () => {
    setBlockBusy('title');
    try {
      const s = await aiContentService.suggestTitles(ctx());
      if (s[0]) setTitle(s[0]);
    } finally {
      setBlockBusy(null);
    }
  };
  const regenDesc = async () => {
    setBlockBusy('desc');
    try {
      const d = await aiContentService.suggestDescription(ctx());
      if (d) setDesc(d);
    } finally {
      setBlockBusy(null);
    }
  };
  const regenPortal = async (portal: 'mercadolibre' | 'zonaprop') => {
    setBlockBusy(portal);
    try {
      const r = await aiContentService.adaptForPortal({ ...ctx(), title, description }, portal);
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
      {blockBusy === key ? <Loader2 size={13} className="vera-spin" /> : <RefreshCw size={13} />} Generar con VERA
    </button>
  );

  return (
    <div className="vera-form">
      {/* Título — campo del formulario */}
      <div className="vera-field">
        <div className="vera-portal-block__head">
          <span className="vera-field__label">Título de la propiedad</span>
          <div className="vera-express__block-actions">
            {regenBtn('title', regenTitle, 'regen-title')}
            {label('title', title, 'copy-express-title')}
          </div>
        </div>
        <input
          className="vera-express__edit-title"
          data-testid="manual-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Escribí el título o generalo con VERA…"
        />
      </div>

      {/* Descripción — campo del formulario */}
      <div className="vera-field">
        <div className="vera-portal-block__head">
          <span className="vera-field__label">Descripción</span>
          <div className="vera-express__block-actions">
            {regenBtn('desc', regenDesc, 'regen-description')}
            {label('desc', description, 'copy-express-description')}
          </div>
        </div>
        <textarea
          className="vera-express__edit-desc"
          data-testid="manual-description"
          value={description}
          rows={12}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Escribí la descripción o generala con VERA…"
        />
        <span className="vera-muted vera-express__hint">
          Lo que ves acá se guarda al tocar “Guardar”. Corregí lo que la IA no sepa (ubicación, detalles). VERA propone; vos decidís.
        </span>
      </div>

      {/* Generar todo */}
      <Button
        type="button"
        variant="primary"
        size="md"
        data-testid="generate-express"
        disabled={status === 'loading'}
        onClick={generate}
      >
        <Rocket size={16} /> {status === 'loading' ? 'VERA está armando la publicación…' : 'Generar publicación completa con VERA'}
      </Button>

      {status === 'error' && (
        <p className="vera-muted" data-testid="express-error">
          VERA no pudo armar la publicación ahora. Probá de nuevo en un momento.
        </p>
      )}

      {/* Resultado: destacados + textos de portales (para copiar) */}
      {status === 'ready' && data && (
        <div className="vera-ai-preview" data-testid="express-result">
          <div className="vera-ai-preview__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="copy-express-all"
              onClick={() =>
                copy(
                  'all',
                  composeAll({ title, description, highlights: data.highlights, mercadolibre: editMl, zonaprop: editZp }),
                )
              }
            >
              {copied === 'all' ? <><Check size={14} /> Copiado todo</> : <><Copy size={14} /> Copiar todo</>}
            </Button>
            <button type="button" className="vera-ai-action" data-testid="regenerate-express" onClick={generate}>
              <RefreshCw size={13} /> Generar todo otra vez
            </button>
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
    </div>
  );
};
