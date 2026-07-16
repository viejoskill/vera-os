import { useCallback, useState } from 'react';
import type { PhotoAsset, PropertyImageAsset } from '@vera/types';
import { propertyFilesGateway } from '@vera/services';

export type LiveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type Notify = (status: LiveStatus, message?: string) => void;

const fromAsset = (img: PropertyImageAsset): PhotoAsset => ({
  id: img.id,
  name: img.originalName,
  url: img.url,
  status: 'ready',
  isCover: img.isCover,
});

/**
 * Live gallery for an EXISTING property. Every action persists immediately to the
 * backend (Supabase). Operations are atomic: on failure the UI reverts to the
 * previous state and reports the error (VERA architecture rule A/B).
 * Cover and order are independent — reordering never changes the cover (rule C).
 */
export function useWorkspaceGallery(
  propertyId: string,
  initial: PropertyImageAsset[],
  notify: Notify,
) {
  const [photos, setPhotos] = useState<PhotoAsset[]>(() =>
    [...initial].sort((a, b) => a.position - b.position).map(fromAsset),
  );

  const addFiles = useCallback(
    (files: File[]) => {
      files
        .filter((f) => f.type.startsWith('image/'))
        .forEach(async (file) => {
          const tempId = `temp-${Date.now()}-${file.name}`;
          const url = URL.createObjectURL(file);
          setPhotos((prev) => [
            ...prev,
            { id: tempId, name: file.name, url, status: 'uploading', isCover: false },
          ]);
          notify('saving');
          try {
            const up = await propertyFilesGateway.uploadImage(propertyId, file);
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === tempId
                  ? { id: up.id, name: up.originalName, url: up.url, status: 'ready', isCover: up.isCover }
                  : p,
              ),
            );
            URL.revokeObjectURL(url);
            notify('saved');
          } catch {
            setPhotos((prev) => prev.filter((p) => p.id !== tempId));
            URL.revokeObjectURL(url);
            notify('error', 'No pudimos subir la foto. Volvé a intentar.');
          }
        });
    },
    [propertyId, notify],
  );

  const removePhoto = useCallback(
    (id: string) => {
      let backup: PhotoAsset[] = [];
      setPhotos((prev) => {
        backup = prev;
        return prev.filter((p) => p.id !== id);
      });
      notify('saving');
      propertyFilesGateway
        .deleteImage(propertyId, id)
        .then(() => notify('saved'))
        .catch(() => {
          setPhotos(backup);
          notify('error', 'No pudimos eliminar la foto.');
        });
    },
    [propertyId, notify],
  );

  const setCover = useCallback(
    (id: string) => {
      let backup: PhotoAsset[] = [];
      setPhotos((prev) => {
        backup = prev;
        return prev.map((p) => ({ ...p, isCover: p.id === id }));
      });
      notify('saving');
      propertyFilesGateway
        .setCover(propertyId, id)
        .then(() => notify('saved'))
        .catch(() => {
          setPhotos(backup);
          notify('error', 'No pudimos cambiar la portada.');
        });
    },
    [propertyId, notify],
  );

  const movePhoto = useCallback(
    (from: number, to: number) => {
      let backup: PhotoAsset[] = [];
      let orderedIds: string[] = [];
      setPhotos((prev) => {
        if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
          return prev;
        }
        backup = prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        orderedIds = next.map((p) => p.id);
        return next;
      });
      if (!orderedIds.length) return;
      notify('saving');
      propertyFilesGateway
        .reorderImages(propertyId, orderedIds)
        .then(() => notify('saved'))
        .catch(() => {
          setPhotos(backup);
          notify('error', 'No pudimos reordenar la galería.');
        });
    },
    [propertyId, notify],
  );

  return { photos, addFiles, removePhoto, setCover, movePhoto };
}
