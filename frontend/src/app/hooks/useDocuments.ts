import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropertyDocument, DocumentType } from '@vera/types';

/** Client-side documents store (mock). Ready to back onto Storage later without UI changes. */
export function useDocuments() {
  const [documents, setDocuments] = useState<PropertyDocument[]>([]);
  const ref = useRef<PropertyDocument[]>([]);
  ref.current = documents;

  useEffect(
    () => () => {
      ref.current.forEach((d) => URL.revokeObjectURL(d.url));
    },
    [],
  );

  const addDocument = useCallback((type: DocumentType, file: File) => {
    const doc: PropertyDocument = {
      id: `${Date.now()}-${file.name}`,
      type,
      name: file.name,
      url: URL.createObjectURL(file),
      mimeType: file.type,
    };
    // One document per type for now.
    setDocuments((prev) => [...prev.filter((d) => d.type !== type), doc]);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const hasType = useCallback(
    (type: DocumentType) => documents.some((d) => d.type === type),
    [documents],
  );

  return { documents, addDocument, removeDocument, hasType };
}
