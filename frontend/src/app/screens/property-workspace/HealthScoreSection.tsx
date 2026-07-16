import { Sparkles, PartyPopper, Check, Circle } from 'lucide-react';
import { Card, Progress } from '@vera/ui';
import type { WorkspaceAssessment } from '@vera/types';

export const HealthScoreSection = ({ assessment }: { assessment: WorkspaceAssessment }) => {
  const { health, nextStep, checklist } = assessment;
  const allDone = checklist.every((c) => c.done);
  const isStart = assessment.completion === 0;

  return (
    <Card className="vera-health" data-testid="health-score">
      <span className="vera-health__caption">Health Score</span>
      {isStart ? (
        <>
          <div className="vera-health__start" data-testid="health-score-value">
            Empecemos
          </div>
          <p className="vera-health__message">
            Cargá los primeros datos y VERA te va guiando paso a paso.
          </p>
        </>
      ) : (
        <>
          <div className="vera-health__score" data-testid="health-score-value">
            {health.score}
          </div>
          <span className="vera-health__label" data-testid="health-score-label">
            {health.label}
          </span>
          <Progress value={health.score} />
          <p className="vera-health__message">{health.message}</p>
        </>
      )}

      <div className="vera-health__path">
        <span className="vera-field__label">
          {isStart ? 'Con esto queda lista para publicar' : '¿Qué falta para llegar a Excelente?'}
        </span>
        <div className="vera-checklist" data-testid="health-checklist">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`vera-check ${item.done ? 'vera-check--done' : ''}`.trim()}
              data-testid={`health-check-${item.id}`}
            >
              <span className="vera-check__icon">
                {item.done ? <Check size={14} /> : <Circle size={14} />}
              </span>
              <span className="vera-check__label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="vera-nextstep" data-testid="health-nextstep">
        {nextStep && !allDone ? (
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
              <span className="vera-nextstep__title">¡Excelente!</span>
              <p className="vera-nextstep__text">La propiedad alcanzó su mejor versión.</p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
