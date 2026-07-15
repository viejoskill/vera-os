import { Check, Circle } from 'lucide-react';
import { Badge } from '@vera/ui';
import type { WorkspaceAssessment } from '@vera/types';

export const PublicationSection = ({ assessment }: { assessment: WorkspaceAssessment }) => {
  const ready = assessment.status === 'ready';

  return (
    <div className="vera-form" data-testid="publication-section">
      <div className="vera-pub__status">
        <span className="vera-field__label">Estado</span>
        <Badge tone={ready ? 'primary' : 'muted'} data-testid="publication-status">
          {ready ? 'Lista para Publicar' : 'En preparación'}
        </Badge>
      </div>

      <div className="vera-checklist" data-testid="publication-checklist">
        {assessment.checklist.map((item) => (
          <div
            key={item.id}
            className={`vera-check ${item.done ? 'vera-check--done' : ''}`.trim()}
            data-testid={`check-${item.id}`}
          >
            <span className="vera-check__icon">
              {item.done ? <Check size={14} /> : <Circle size={14} />}
            </span>
            <span className="vera-check__label">{item.label}</span>
            {item.optional && !item.done && <span className="vera-check__opt">opcional</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
