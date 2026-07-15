import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, X, Loader2, Star, ArrowUp, ArrowDown } from 'lucide-react';
import type { PhotoAsset } from '@vera/types';

interface PhotosSectionProps {
  photos: PhotoAsset[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  onMove: (from: number, to: number) => void;
}

export const PhotosSection = ({
  photos,
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
                <div className="vera-photo__move">
                  <button
                    type="button"
                    aria-label="Subir foto"
                    data-testid={`move-up-${p.id}`}
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(index, index - 1);
                    }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar foto"
                    data-testid={`move-down-${p.id}`}
                    disabled={index === photos.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(index, index + 1);
                    }}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
