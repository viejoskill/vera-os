import { Badge } from '@vera/ui';
import type { WorkspaceAssessment } from '@vera/types';

/** Publication status only — the single "what's missing" checklist lives in the Health card. */
export const PublicationSection = ({ assessment }: { assessment: WorkspaceAssessment }) => {
  const ready = assessment.status === 'ready';
  const core = assessment.checklist.filter((c) => !c.optional);
  const coreDone = core.filter((c) => c.done).length;

  return (
    <div className="vera-form" data-testid="publication-section">
      <div className="vera-pub__status">
        <span className="vera-field__label">Estado</span>
        <Badge tone={ready ? 'primary' : 'muted'} data-testid="publication-status">
          {ready ? 'Lista para publicar' : 'En preparación'}
        </Badge>
      </div>

      <p className="vera-muted" data-testid="publication-summary">
        {ready
          ? 'Cumple todos los requisitos para publicarse.'
          : `${coreDone} de ${core.length} requisitos listos para publicar.`}
      </p>
    </div>
  );
};
