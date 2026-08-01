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

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status}`);
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
  options?: { value: string; label: string }[];
  default?: unknown;
}

export interface TemplateDetail extends TemplateRow {
  description: string;
  variables: TemplateVariable[];
  signatureMethods: string[];
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
  options?: { value: string; label: string }[];
  value: unknown;
  origin?: 'property' | 'person' | 'system' | 'input' | 'default' | null;
  status: 'resolved' | 'input' | 'missing' | 'warning';
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
  signatureMethod?: string | null;
  signers?: { personId: string; role?: string | null; signatureRequired?: boolean; order?: number }[];
}

export interface DocumentParticipant {
  id: string;
  documentId: string;
  personId?: string | null;
  personName?: string | null;
  role?: string | null;
  signatureRequired: boolean;
  signatureStatus: 'pending' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'expired';
  signatureMethod?: string | null;
  order?: number | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  signedAt?: string | null;
  rejectedAt?: string | null;
}

export interface DocumentDetail extends DocumentRow {
  templateId: string;
  signatureMethod?: string | null;
  signatureState: 'none' | 'pending' | 'in_progress' | 'signed' | 'rejected';
  templateSnapshot?: { signatureMethods?: string[]; body?: unknown };
  resolvedVariables?: Record<string, unknown>;
  lockedAt?: string | null;
  createdAt?: string;
  participants: DocumentParticipant[];
  relationships: { id: string; entityType: string; entityId: string; role?: string | null }[];
}

export interface DocumentEvent {
  id?: string;
  type: string;
  createdAt?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

export interface SendPayload {
  channel: 'whatsapp' | 'email' | 'link';
  baseUrl: string;
}
export interface SendResult {
  channel: string;
  url: string;
  message: string;
  whatsappUrl?: string;
  mailtoUrl?: string;
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

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'detail', id],
    queryFn: () => apiGet<DocumentDetail>(`/${id}`),
    enabled: !!id,
  });
}

export function useDocumentHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'history', id],
    queryFn: () => apiGet<DocumentEvent[]>(`/${id}/history`),
    enabled: !!id,
  });
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

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => apiDelete(`/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useSetSignatureMethod(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signatureMethod: string) =>
      apiPatch<DocumentDetail>(`/${documentId}/signature-method`, { signatureMethod }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', 'detail', documentId] }),
  });
}

export function useSendSignature(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, ...payload }: SendPayload & { participantId: string }) =>
      apiPost<SendResult>(`/${documentId}/participants/${participantId}/send`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'detail', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documents', 'history', documentId] });
    },
  });
}

export function pdfUrl(documentId: string): string {
  return `${BASE}/${documentId}/pdf`;
}

export function useDocumentsByProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['documents', 'by-property', propertyId],
    queryFn: () => apiGet<DocumentDetail[]>(`/by-property/${propertyId}`),
    enabled: !!propertyId,
  });
}
