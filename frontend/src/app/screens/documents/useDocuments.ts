import { useQuery } from '@tanstack/react-query';
import { env } from '@vera/config';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${env.backendUrl}/api/documents${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export interface TemplateRow {
  id: string;
  templateKey: string;
  name: string;
  category: string;
  version: number;
  status: string;
}

export interface DocumentRow {
  id: string;
  number?: number;
  templateKey: string;
  templateVersion: number;
  category: string;
  title: string;
  status: string;
  pdfStatus: string;
  createdAt?: string;
}

export function useTemplates() {
  return useQuery({ queryKey: ['documents', 'templates'], queryFn: () => apiGet<TemplateRow[]>('/templates') });
}

export function useDocuments() {
  return useQuery({ queryKey: ['documents', 'list'], queryFn: () => apiGet<DocumentRow[]>('') });
}
