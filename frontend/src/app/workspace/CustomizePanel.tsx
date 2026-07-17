import { useEffect, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw } from 'lucide-react';
import { WIDGETS } from './widget-registry';

interface CustomizePanelProps {
  open: boolean;
  onClose: () => void;
  isEnabled: (id: string) => boolean;
  toggle: (id: string) => void;
  reset: () => void;
}

/** Panel lateral "Personalizar escritorio" — encender/apagar widgets (como
 * personalizar un escritorio, no como aplicar filtros). Reordenar llegará con
 * Drag & Drop en un sprint futuro. */
export const CustomizePanel = ({ open, onClose, isEnabled, toggle, reset }: CustomizePanelProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <>
      <div
        className={`vera-cust__scrim ${open ? 'is-open' : ''}`.trim()}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`vera-cust ${open ? 'is-open' : ''}`.trim()}
        data-testid="customize-panel"
        aria-hidden={!open}
      >
        <header className="vera-cust__head">
          <div>
            <h2 className="vera-cust__title">Personalizar escritorio</h2>
            <p className="vera-cust__sub">Elegí qué widgets querés ver en tu espacio.</p>
          </div>
          <button type="button" className="vera-cust__close" data-testid="customize-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="vera-cust__list">
          <span className="vera-cust__group">Widgets</span>
          {WIDGETS.map((w) => {
            const on = isEnabled(w.id);
            return (
              <button
                key={w.id}
                type="button"
                className={`vera-cust__item ${on ? 'is-on' : ''}`.trim()}
                data-testid={`customize-toggle-${w.id}`}
                role="switch"
                aria-checked={on}
                onClick={() => toggle(w.id)}
              >
                <span className="vera-cust__check" aria-hidden="true" />
                <span className="vera-cust__item-icon"><w.icon size={16} /></span>
                <span className="vera-cust__item-label">{w.title}</span>
                {w.demo && <span className="vera-cust__demo">Demo</span>}
              </button>
            );
          })}
        </div>

        <footer className="vera-cust__foot">
          <button type="button" className="vera-ai-action" data-testid="customize-reset" onClick={reset}>
            <RotateCcw size={13} /> Restablecer widgets
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  ) as unknown as ReactElement;
};
