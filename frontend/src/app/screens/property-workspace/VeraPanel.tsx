import { Sparkles, Check, Circle, AlertCircle } from 'lucide-react';
import { Card, Badge, Progress } from '@vera/ui';
import type { VeraInsights } from '@vera/types';

export const VeraPanel = ({ insights }: { insights: VeraInsights }) => {
  const { quality, detectedRooms, missingFields, recommendations } = insights;

  return (
    <aside className="vera-workspace__aside" data-testid="vera-panel">
      <Card className="vera-assistant">
        <div className="vera-assistant__header">
          <span className="vera-assistant__mark">
            <Sparkles size={16} />
          </span>
          <div>
            <div className="vera-assistant__name">
              VERA <Badge tone="muted">demo</Badge>
            </div>
            <div className="vera-assistant__role">Asistente de publicación</div>
          </div>
        </div>

        <div className="vera-assistant__section">
          <div className="vera-quality__row">
            <span className="vera-field__label">Calidad de la publicación</span>
            <span className="vera-quality__value" data-testid="vera-quality-score">
              {quality.score}% · {quality.label}
            </span>
          </div>
          <Progress value={quality.score} />
        </div>

        <div className="vera-assistant__section">
          <span className="vera-field__label">Ambientes detectados</span>
          {detectedRooms.length > 0 ? (
            <div className="vera-chips" data-testid="detected-rooms">
              {detectedRooms.map((room) => (
                <Badge key={room} tone="default">
                  {room}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="vera-muted">Subí fotos para que VERA detecte los ambientes.</p>
          )}
        </div>

        <div className="vera-assistant__section">
          <span className="vera-field__label">Campos faltantes</span>
          {missingFields.length > 0 ? (
            <div className="vera-missing" data-testid="missing-fields">
              {missingFields.map((f) => (
                <span key={f} className="vera-missing__item">
                  <AlertCircle size={14} /> {f}
                </span>
              ))}
            </div>
          ) : (
            <p className="vera-muted">¡Todo listo para publicar!</p>
          )}
        </div>

        <div className="vera-assistant__section">
          <span className="vera-field__label">Recomendaciones</span>
          <div className="vera-reco">
            {recommendations.map((r) => (
              <div
                key={r.id}
                className={`vera-reco__item ${r.done ? 'vera-reco__item--done' : ''}`.trim()}
              >
                <span className="vera-reco__icon">
                  {r.done ? <Check size={14} /> : <Circle size={14} />}
                </span>
                {r.text}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </aside>
  );
};
