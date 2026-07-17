import { useEffect, useRef, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Search, Building2, CalendarPlus, FileText } from 'lucide-react';

/** Capa de IA (RESERVADA). Modal estilo Spotlight/Raycast. Placeholder: aún NO
 * ejecuta IA — deja preparada la experiencia futura "Preguntale a VERA". */
export const SpotlightModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="vera-spot" data-testid="spotlight-modal" onClick={onClose}>
      <div className="vera-spot__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="vera-spot__field">
          <Search size={18} className="vera-spot__search-icon" />
          <input
            ref={inputRef}
            className="vera-spot__input"
            data-testid="spotlight-input"
            placeholder="Preguntale a VERA…"
          />
          <button type="button" className="vera-spot__close" data-testid="spotlight-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="vera-spot__hint">
          <Sparkles size={13} /> VERA pronto va a entender lo que necesitás. Por ahora, elegí una acción rápida.
        </div>

        <div className="vera-spot__actions">
          <span className="vera-spot__label">Sugerencias</span>
          <button type="button" className="vera-spot__action" disabled>
            <Building2 size={16} /> Cargar una propiedad nueva
          </button>
          <button type="button" className="vera-spot__action" disabled>
            <CalendarPlus size={16} /> Agendar una visita
          </button>
          <button type="button" className="vera-spot__action" disabled>
            <FileText size={16} /> Generar contenido para un aviso
          </button>
          <span className="vera-spot__soon">Próximamente</span>
        </div>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
