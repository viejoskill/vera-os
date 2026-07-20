import { Sparkles, ArrowUpRight, FileText, Circle, CheckCircle2 } from 'lucide-react';
import { Button } from '@vera/ui';

type ContentState = 'none' | 'generated' | 'outdated';

const STATES: { id: ContentState; label: string }[] = [
  { id: 'none', label: 'Nunca generado' },
  { id: 'generated', label: 'Generado' },
  { id: 'outdated', label: 'Desactualizado' },
];

/**
 * Comercialización — muestra SOLO el estado del contenido comercial (título +
 * descripción). No genera publicaciones acá: el centro creativo es Studio. El botón
 * principal abre la propiedad en Studio con su contexto.
 */
export const CommercializationSection = ({
  hasTitle,
  hasDescription,
  onOpenStudio,
}: {
  hasTitle: boolean;
  hasDescription: boolean;
  onOpenStudio: () => void;
}) => {
  const current: ContentState = hasTitle || hasDescription ? 'generated' : 'none';

  return (
    <div className="vera-commerce" data-testid="commercialization-section">
      <div className="vera-commerce__grid">
        <div className="vera-commerce__item" data-testid="commerce-title">
          <span className="vera-commerce__k"><Sparkles size={14} /> Título</span>
          <span className="vera-commerce__v">{hasTitle ? 'Generado' : 'Sin generar'}</span>
        </div>
        <div className="vera-commerce__item" data-testid="commerce-description">
          <span className="vera-commerce__k"><FileText size={14} /> Descripción</span>
          <span className="vera-commerce__v">{hasDescription ? 'Generada' : 'Sin generar'}</span>
        </div>
      </div>

      <div className="vera-commerce__states" role="radiogroup" aria-label="Estado del contenido comercial">
        {STATES.map((s) => {
          const active = s.id === current;
          return (
            <span
              key={s.id}
              className={`vera-commerce__state ${active ? 'vera-commerce__state--active' : ''}`.trim()}
              data-testid={`commerce-state-${s.id}`}
              aria-checked={active}
              role="radio"
            >
              {active ? <CheckCircle2 size={15} /> : <Circle size={15} />} {s.label}
            </span>
          );
        })}
      </div>

      <Button variant="primary" size="md" data-testid="open-in-studio" onClick={onOpenStudio}>
        <Sparkles size={16} /> Abrir en Studio <ArrowUpRight size={15} />
      </Button>
      <p className="vera-muted vera-commerce__hint">
        Studio es el centro creativo de VERA. Ahí generás y editás el contenido comercial de esta propiedad.
      </p>
    </div>
  );
};
