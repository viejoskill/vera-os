/** Property documents. Structured to grow (escritura, reglamento, etc.); today only 'plano'. */
export type DocumentType = 'plano';

export interface PropertyDocument {
  id: string;
  type: DocumentType;
  name: string;
  url: string;
  mimeType: string;
  file?: File;
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  plano: 'Plano',
};
