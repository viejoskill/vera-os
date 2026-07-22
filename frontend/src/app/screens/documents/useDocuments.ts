import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '@vera/config';

const BASE = `${env.backendUrl}/api/documents`;

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = (await res.json())?.detail;
    } catch {
      detail = undefined;
    }
    if (typeof detail === 'string') throw new Error(detail);
    if (detail && typeof detail === 'object') {
      const d = detail as { message?: string; missing?: string[] };
      const msg = d.message ?? 'No se pudo crear el documento.';
      throw new Error(d.missing?.length ? `${msg} Faltan: ${d.missing.join(', ')}` : msg);
    }
    throw new Error(`${res.status}`);
  }
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

/** Definición de una variable del template (NO su valor). */
export interface TemplateVariable {
  key: string;
  label: string;
  source: 'person' | 'property' | 'input' | 'system';
  role?: string | null;
  path?: string | null;
  type: string;
  required: boolean;
}

export interface TemplateDetail extends TemplateRow {
  description: string;
  variables: TemplateVariable[];
  body?: unknown;
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

/** Persona vinculada a un rol del documento. */
export interface PersonLinkInput {
  personId: string;
  role: string;
}

export interface ResolveField {
  key: string;
  label: string;
  type: string;
  source: TemplateVariable['source'];
  role?: string | null;
  required: boolean;
  value: unknown;
  origin?: 'property' | 'person' | 'system' | 'input' | null;
  status: 'resolved' | 'missing' | 'warning' | 'optional';
}

export interface ResolveResult {
  requirements: { needsProperty: boolean; personRoles: string[]; inputFields: TemplateVariable[] };
  resolved: Record<string, unknown>;
  missing: string[];
  warnings: string[];
  fields: ResolveField[];
  ready: boolean;
}

export interface CreateDocumentPayload {
  templateId: string;
  title?: string;
  propertyId?: string | null;
  persons: PersonLinkInput[];
  inputs: Record<string, unknown>;
  origin?: string;
}

export function useTemplates() {
  return useQuery({ queryKey: ['documents', 'templates'], queryFn: () => apiGet<TemplateRow[]>('/templates') });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'template', id],
    queryFn: () => apiGet<TemplateDetail>(`/templates/${id}`),
    enabled: !!id,
  });
}

export function useDocuments() {
  return useQuery({ queryKey: ['documents', 'list'], queryFn: () => apiGet<DocumentRow[]>('') });
}

export function useResolveDocument() {
  return useMutation({
    mutationFn: (payload: Omit<CreateDocumentPayload, 'title' | 'origin'>) =>
      apiPost<ResolveResult>('/resolve', payload),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDocumentPayload) => apiPost<DocumentRow>('', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}
