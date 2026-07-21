import { env } from '@vera/config';
import type {
  NewPersonInput,
  Person,
  PersonConversation,
  PersonEvent,
  PersonListItem,
  PersonPropertyRelation,
  PersonUpdateInput,
} from '@vera/types';
import type { PeopleGateway } from './people-gateway';

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
}
