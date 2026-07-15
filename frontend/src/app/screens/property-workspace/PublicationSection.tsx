import { Check, Circle } from 'lucide-react';
import { Badge } from '@vera/ui';
import type { WorkspaceAssessment } from '@vera/types';

export const PublicationSection = ({ assessment }: { assessment: WorkspaceAssessment }) => {
  const ready = assessment.status === 'ready';
  // Publicación focuses on the requirements to publish (core items).
  const core = assessment.checklist.filter((c) => !c.optional);
  const coreDone = core.filter((c) => c.done).length;

  return (
    <div className="vera-form" data-testid="publication-section">
      <div className="vera-pub__status">
        <span className="vera-field__label">Estado</span>
        <Badge tone={ready ? 'primary' : 'muted'} data-testid="publication-status">
          {ready ? 'Lista para Publicar' : 'En preparación'}
        </Badge>
      </div>

      <p className="vera-muted" data-testid="publication-summary">
        {ready
          ? 'Cumple todos los requisitos para publicarse.'
          : `${coreDone} de ${core.length} requisitos listos para publicar.`}
      </p>

      <div className="vera-checklist" data-testid="publication-checklist">
        {core.map((item) => (
          <div
            key={item.id}
            className={`vera-check ${item.done ? 'vera-check--done' : ''}`.trim()}
            data-testid={`check-${item.id}`}
          >
            <span className="vera-check__icon">
              {item.done ? <Check size={14} /> : <Circle size={14} />}
            </span>
            <span className="vera-check__label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
