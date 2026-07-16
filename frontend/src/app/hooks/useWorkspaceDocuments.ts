import { useCallback, useState } from 'react';
import type { DocumentType, PropertyDocument, PropertyDocumentAsset } from '@vera/types';
import { propertyFilesGateway } from '@vera/services';
import type { Notify } from './useWorkspaceGallery';

const fromAsset = (d: PropertyDocumentAsset): PropertyDocument => ({
  id: d.id,
  type: d.docType as DocumentType,
  name: d.originalName,
  url: d.url,
  mimeType: d.mimeType,
});

/** Live documents for an EXISTING property. Uploads/removals persist immediately
 *  with atomic rollback on failure (VERA architecture rule A/B). */
export function useWorkspaceDocuments(
  propertyId: string,
  initial: PropertyDocumentAsset[],
  notify: Notify,
) {
  const [documents, setDocuments] = useState<PropertyDocument[]>(() => initial.map(fromAsset));

  const addDocument = useCallback(
    (type: DocumentType, file: File) => {
      const tempId = `temp-${Date.now()}`;
      const url = URL.createObjectURL(file);
      let backup: PropertyDocument[] = [];
      setDocuments((prev) => {
        backup = prev;
        return [
          ...prev.filter((d) => d.type !== type),
          { id: tempId, type, name: file.name, url, mimeType: file.type },
        ];
      });
      notify('saving');
      propertyFilesGateway
        .uploadDocument(propertyId, file, type)
        .then((res) => {
          setDocuments((prev) => prev.map((d) => (d.id === tempId ? { ...d, id: res.id } : d)));
          notify('saved');
        })
        .catch(() => {
          setDocuments(backup);
          URL.revokeObjectURL(url);
          notify('error', 'No pudimos subir el documento.');
        });
    },
    [propertyId, notify],
  );

  const removeDocument = useCallback(
    (id: string) => {
      let backup: PropertyDocument[] = [];
      setDocuments((prev) => {
        backup = prev;
        return prev.filter((d) => d.id !== id);
      });
      notify('saving');
      propertyFilesGateway
        .deleteDocument(propertyId, id)
        .then(() => notify('saved'))
        .catch(() => {
          setDocuments(backup);
          notify('error', 'No pudimos eliminar el documento.');
        });
    },
    [propertyId, notify],
  );

  return { documents, addDocument, removeDocument };
}
