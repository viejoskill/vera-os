import { Circle, CheckCircle2 } from 'lucide-react';
import { Card, Progress } from '@vera/ui';
import type { WorkspaceAssessment } from '@vera/types';

/** Compact health summary: score + estado + recomendaciones pendientes.
 *  Deliberately understated so the focus can move to commercial activity once ready. */
export const HealthScoreSection = ({ assessment }: { assessment: WorkspaceAssessment }) => {
  const { health, checklist } = assessment;
  const isStart = assessment.completion === 0;
  const pending = checklist.filter((c) => !c.done);

  return (
    <Card className="vera-health vera-health--compact" data-testid="health-score">
      <div className="vera-health__row">
        <span className="vera-health__caption">Health Score</span>
        {!isStart && (
          <span className="vera-health__label" data-testid="health-score-label">
            {health.label}
          </span>
        )}
      </div>

      {isStart ? (
        <p className="vera-health__message" data-testid="health-score-value">
          Empecemos — cargá los primeros datos y VERA te va guiando.
        </p>
      ) : (
        <>
          <div className="vera-health__scoreline">
            <span className="vera-health__score-sm" data-testid="health-score-value">
              {health.score}
            </span>
            <Progress value={health.score} />
          </div>

          {pending.length > 0 ? (
            <div className="vera-health__pending" data-testid="health-checklist">
              <span className="vera-field__label">Recomendaciones pendientes</span>
              <ul className="vera-health__pending-list">
                {pending.map((item) => (
                  <li key={item.id} data-testid={`health-check-${item.id}`}>
                    <Circle size={13} /> {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="vera-health__ready" data-testid="health-checklist">
              <CheckCircle2 size={15} /> Lista para publicar
            </p>
          )}
        </>
      )}
    </Card>
  );
};
