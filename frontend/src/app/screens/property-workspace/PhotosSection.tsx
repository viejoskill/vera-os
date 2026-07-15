import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, X, Check, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
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
}

export const PhotosSection = ({
  photos,
  stages,
  processing,
  duplicatesRemoved,
  onAddFiles,
  onRemove,
}: PhotosSectionProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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

          <div className="vera-photos" data-testid="photos-grid">
            {photos.map((p) => (
              <div key={p.id} className="vera-photo" data-testid={`photo-${p.id}`}>
                <img src={p.url} alt={p.name} className="vera-photo__img" />
                {p.status !== 'ready' && (
                  <div className="vera-photo__overlay">
                    <Loader2 size={18} className="vera-spin" />
                  </div>
                )}
                {p.isCover && (
                  <span className="vera-photo__cover">
                    <ImageIcon size={12} /> Portada
                  </span>
                )}
                <button
                  type="button"
                  className="vera-photo__remove"
                  aria-label="Quitar foto"
                  onClick={() => onRemove(p.id)}
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
