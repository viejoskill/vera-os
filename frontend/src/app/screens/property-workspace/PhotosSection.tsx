import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, X, Check, Loader2, Sparkles, Star } from 'lucide-react';
import { Badge } from '@vera/ui';
import type { PhotoAsset } from '@vera/types';
import type { StudioStageView } from '@app/hooks/useVeraStudio';

interface PhotosSectionProps {
  photos: PhotoAsset[];
  stages: StudioStageView[];
  processing: boolean;
  duplicatesRemoved: number;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  onMove: (from: number, to: number) => void;
}

export const PhotosSection = ({
  photos,
  stages,
  processing,
  duplicatesRemoved,
  onAddFiles,
  onRemove,
  onSetCover,
  onMove,
}: PhotosSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    onAddFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="vera-form">
      <div
        className={`vera-dropzone ${dragging ? 'vera-dropzone--active' : ''}`.trim()}
        data-testid="photos-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className="vera-dropzone__icon">
          <UploadCloud size={26} />
        </span>
        <p className="vera-dropzone__text">
          Arrastrá tus fotos acá o <span>seleccioná archivos</span>
        </p>
        <p className="vera-muted">JPG o PNG · VERA las procesa automáticamente</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          data-testid="photo-file-input"
          hidden
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>

      {photos.length > 0 && (
        <>
          <div className="vera-studio">
            <div className="vera-studio__title">
              <Sparkles size={15} /> Vera Studio
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
            {!processing && duplicatesRemoved > 0 && (
              <p className="vera-muted">
                {duplicatesRemoved} foto duplicada eliminada automáticamente.
              </p>
            )}
          </div>

          <p className="vera-muted">
            Arrastrá para reordenar la galería · Clic en una foto para elegir la portada. VERA
            sugiere, vos decidís.
          </p>
          <div className="vera-photos" data-testid="photos-grid">
            {photos.map((p, index) => (
              <div
                key={p.id}
                className={`vera-photo ${dragIndex === index ? 'vera-photo--dragging' : ''}`.trim()}
                data-testid={`photo-${p.id}`}
                draggable
                onClick={() => onSetCover(p.id)}
                onDragStart={(e: DragEvent<HTMLDivElement>) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e: DragEvent<HTMLDivElement>) => e.preventDefault()}
                onDrop={(e: DragEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  if (dragIndex !== null) onMove(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <img
                  src={p.url}
                  alt={p.name}
                  className="vera-photo__img"
                  draggable={false}
                />
                <span className="vera-photo__order">{index + 1}</span>
                {p.status !== 'ready' && (
                  <div className="vera-photo__overlay">
                    <Loader2 size={18} className="vera-spin" />
                  </div>
                )}
                {p.isCover ? (
                  <span className="vera-photo__cover" data-testid={`cover-${p.id}`}>
                    <Star size={12} /> Portada
                  </span>
                ) : (
                  <span className="vera-photo__hint">Hacer portada</span>
                )}
                <button
                  type="button"
                  className="vera-photo__remove"
                  aria-label="Quitar foto"
                  data-testid={`remove-photo-${p.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(p.id);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
