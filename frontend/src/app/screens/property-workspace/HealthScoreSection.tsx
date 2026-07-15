import { Sparkles, PartyPopper } from 'lucide-react';
import { Card, Progress } from '@vera/ui';
import type { WorkspaceAssessment } from '@vera/types';

export const HealthScoreSection = ({ assessment }: { assessment: WorkspaceAssessment }) => {
  const { health, nextStep } = assessment;

  return (
    <Card className="vera-health" data-testid="health-score">
      <span className="vera-health__caption">Health Score</span>
      <div className="vera-health__score" data-testid="health-score-value">
        {health.score}
      </div>
      <span className="vera-health__label" data-testid="health-score-label">
        {health.label}
      </span>
      <Progress value={health.score} />
      <p className="vera-health__message">{health.message}</p>

      <div className="vera-nextstep" data-testid="health-nextstep">
        {nextStep ? (
          <>
            <span className="vera-nextstep__icon">
              <Sparkles size={15} />
            </span>
            <div>
              <span className="vera-nextstep__title">Siguiente paso recomendado</span>
              <p className="vera-nextstep__text">{nextStep}</p>
            </div>
          </>
        ) : (
          <>
            <span className="vera-nextstep__icon">
              <PartyPopper size={15} />
            </span>
            <div>
              <span className="vera-nextstep__title">¡Todo listo!</span>
              <p className="vera-nextstep__text">La propiedad quedó lista para publicarse.</p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
