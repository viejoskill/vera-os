import { Check, Loader2, Star, Images, Sparkles, ListOrdered } from 'lucide-react';
import { Badge } from '@vera/ui';
import { studioService } from '@vera/services';
import type { PhotoAsset } from '@vera/types';
import type { StudioStageView } from '@app/hooks/useVeraStudio';

interface VeraStudioSectionProps {
  photos: PhotoAsset[];
  stages: StudioStageView[];
  processing: boolean;
  detectedRooms: string[];
  duplicatesRemoved: number;
}

export const VeraStudioSection = ({
  photos,
  stages,
  processing,
  detectedRooms,
  duplicatesRemoved,
}: VeraStudioSectionProps) => {
  const count = photos.length;

  if (count === 0) {
    return (
      <div className="vera-studio-empty" data-testid="studio-empty">
        <Sparkles size={18} />
        <p>Subí fotos y VERA las analizará para ayudarte a armar la mejor publicación.</p>
      </div>
    );
  }

  const coverIndex = photos.findIndex((p) => p.isCover);
  const coverLabel = coverIndex >= 0 ? `Foto #${coverIndex + 1}` : 'A definir';
  const quality = studioService.photoQuality(count);
  const observation = processing
    ? 'VERA está procesando tus fotos…'
    : duplicatesRemoved > 0
      ? `Iluminación optimizada · ${duplicatesRemoved} foto duplicada eliminada.`
      : 'Iluminación y perspectiva optimizadas en todas las fotos.';

  const suggestions = [
    { id: 'cover', icon: <Star size={15} />, label: 'Portada sugerida', value: coverLabel },
    { id: 'quality', icon: <Images size={15} />, label: 'Calidad de fotografías', value: quality },
    {
      id: 'count',
      icon: <Images size={15} />,
      label: 'Cantidad de imágenes',
      value: `${count} de ${studioService.recommendedCount} recomendadas`,
    },
    {
      id: 'order',
      icon: <ListOrdered size={15} />,
      label: 'Orden recomendado',
      value: studioService.recommendedOrder.slice(0, 4).join(' · ') + '…',
    },
  ];

  return (
    <div className="vera-form">
      <div className="vera-studio-live" data-testid="studio-live">
        <div className="vera-studio__title">
          <Sparkles size={15} /> VERA está colaborando
          <Badge tone="muted">demo</Badge>
        </div>
        <div className="vera-studio-steps">
          {stages.map((s) => (
            <div
              key={s.id}
              className={`vera-studio-step vera-studio-step--${s.state}`}
              data-testid={`studio-stage-${s.id}`}
            >
              <span className="vera-studio-step__icon">
                {s.state === 'done' ? (
                  <Check size={14} />
                ) : s.state === 'running' ? (
                  <Loader2 size={14} className="vera-spin" />
                ) : (
                  <span className="vera-dot" />
                )}
              </span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="vera-sugg" data-testid="studio-suggestions">
        {suggestions.map((s) => (
          <div key={s.id} className="vera-sugg__item">
            <span className="vera-sugg__icon">{s.icon}</span>
            <div className="vera-sugg__body">
              <span className="vera-sugg__label">{s.label}</span>
              <span className="vera-sugg__value">{s.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="vera-sugg__note">
        <span className="vera-field__label">Observaciones automáticas</span>
        <p className="vera-muted">{observation}</p>
      </div>

      {detectedRooms.length > 0 && (
        <div>
          <span className="vera-field__label">Ambientes detectados</span>
          <div className="vera-chips" data-testid="detected-rooms">
            {detectedRooms.map((room) => (
              <Badge key={room}>{room}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
