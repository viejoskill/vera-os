import { env } from '@vera/config';
import type { NewPersonInput, Person } from '@vera/types';
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

  list(role?: string): Promise<Person[]> {
    return this.request<Person[]>(role ? `?role=${encodeURIComponent(role)}` : '');
  }

  create(input: NewPersonInput): Promise<Person> {
    return this.request<Person>('', { method: 'POST', body: JSON.stringify(input) });
  }
}
