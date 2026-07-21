import { env } from '@vera/config';
import type {
  NewPersonInput,
  PeopleFacets,
  PeopleTableParams,
  Person,
  PersonConversation,
  PersonEvent,
  PersonKnowledge,
  PersonListItem,
  PersonPropertyRelation,
  PersonTableResponse,
  PersonUpdateInput,
} from '@vera/types';
import type { PeopleGateway } from './people-gateway';

/** Construye el querystring de la tabla/exportación (filtros de negocio AND). */
const buildTableQuery = (params: PeopleTableParams): URLSearchParams => {
  const qs = new URLSearchParams();
  if (params.query) qs.set('query', params.query);
  (params.facts ?? []).forEach((f) => {
    if (f.type) qs.append('facts', f.value ? `${f.type}:${f.value}` : f.type);
  });
  if (params.budgetMin != null) qs.set('budgetMin', String(params.budgetMin));
  if (params.budgetMax != null) qs.set('budgetMax', String(params.budgetMax));
  if (params.confidenceMin != null) qs.set('confidenceMin', String(params.confidenceMin));
  if (params.contactedWithin != null) qs.set('contactedWithin', String(params.contactedWithin));
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
  return qs;
};

/** Habla con el backend de VERA (FastAPI). El frontend nunca conoce Supabase. */
export class ApiPeopleGateway implements PeopleGateway {
  private readonly base = `${env.backendUrl}/api/people`;

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!res.ok) throw new Error(`VERA API ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  list(role?: string): Promise<PersonListItem[]> {
    return this.request<PersonListItem[]>(role ? `?role=${encodeURIComponent(role)}` : '');
  }

  get(id: string): Promise<Person> {
    return this.request<Person>(`/${id}`);
  }

  create(input: NewPersonInput): Promise<Person> {
    return this.request<Person>('', { method: 'POST', body: JSON.stringify(input) });
  }

  update(id: string, patch: PersonUpdateInput): Promise<Person> {
    return this.request<Person>(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  async relations(id: string): Promise<PersonPropertyRelation[]> {
    const res = await this.request<{ properties: PersonPropertyRelation[] }>(`/${id}/relations`);
    return res.properties;
  }

  async conversations(id: string): Promise<PersonConversation[]> {
    const res = await this.request<{ conversations: PersonConversation[] }>(`/${id}/conversations`);
    return res.conversations;
  }

  async timeline(id: string): Promise<PersonEvent[]> {
    const res = await this.request<{ events: PersonEvent[] }>(`/${id}/timeline`);
    return res.events;
  }

  knowledge(id: string): Promise<PersonKnowledge> {
    return this.request<PersonKnowledge>(`/${id}/knowledge`);
  }

  table(params: PeopleTableParams): Promise<PersonTableResponse> {
    const qs = buildTableQuery(params).toString();
    return this.request<PersonTableResponse>(`/table${qs ? `?${qs}` : ''}`);
  }

  facets(): Promise<PeopleFacets> {
    return this.request<PeopleFacets>('/facets');
  }

  exportUrl(format: 'csv' | 'xlsx', params: PeopleTableParams, columns: string[], ids?: string[]): string {
    const qs = buildTableQuery(params);
    qs.set('format', format);
    if (columns.length) qs.set('columns', columns.join(','));
    if (ids && ids.length) qs.set('ids', ids.join(','));
    return `${this.base}/export?${qs.toString()}`;
  }
}
