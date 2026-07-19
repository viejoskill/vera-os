import { useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, Globe, Plus, Trash2, Check } from 'lucide-react';
import type { SiteConfig } from './types';
import { hostOf } from './useIntegrations';

interface Props {
  open: boolean;
  onClose: () => void;
  config: SiteConfig;
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  onSetPrimary: (url: string) => void;
}

/** Gestión de dominios del Sitio Web — FUENTE ÚNICA (Integraciones). Agregar,
 * quitar y elegir el dominio principal que consumen las Acciones Rápidas. */
export const SiteDomainsModal = ({ open, onClose, config, onAdd, onRemove, onSetPrimary }: Props): ReactElement | null => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  };

  return createPortal(
    <div className="vera-overlay" onClick={onClose}>
      <div
        className="vera-site-modal"
        data-testid="site-domains-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="vera-site-modal__head">
          <div className="vera-site-modal__title">
            <span className="vera-site-modal__icon"><Globe size={16} /></span>
            <div>
              <h3>Dominios del Sitio Web</h3>
              <p className="vera-muted">Elegí el principal — es el que abre "Abrir Sitio Web".</p>
            </div>
          </div>
          <button type="button" className="vera-site-modal__close" data-testid="site-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="vera-site-modal__add">
          <input
            type="text"
            className="vera-input"
            placeholder="tuinmobiliaria.com"
            value={value}
            data-testid="site-domain-input"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button type="button" className="vera-btn vera-btn--primary vera-btn--sm" data-testid="site-domain-add" onClick={submit}>
            <Plus size={14} /> Agregar
          </button>
        </div>

        {config.domains.length === 0 ? (
          <p className="vera-site-modal__empty" data-testid="site-domains-empty">
            Todavía no agregaste ningún dominio.
          </p>
        ) : (
          <ul className="vera-site-modal__list" data-testid="site-domains-list">
            {config.domains.map((url) => {
              const isPrimary = config.primary === url;
              return (
                <li key={url} className={`vera-site-domain ${isPrimary ? 'is-primary' : ''}`.trim()}>
                  <button
                    type="button"
                    className="vera-site-domain__pick"
                    data-testid={`site-domain-primary-${hostOf(url)}`}
                    onClick={() => onSetPrimary(url)}
                    aria-label="Marcar como principal"
                  >
                    <span className="vera-site-domain__radio">{isPrimary && <Check size={12} />}</span>
                    <span className="vera-site-domain__host">{hostOf(url)}</span>
                    {isPrimary && <span className="vera-site-domain__badge">Principal</span>}
                  </button>
                  <button
                    type="button"
                    className="vera-site-domain__del"
                    data-testid={`site-domain-remove-${hostOf(url)}`}
                    onClick={() => onRemove(url)}
                    aria-label="Quitar dominio"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
