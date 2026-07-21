import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw } from 'lucide-react';
import { env } from '@vera/config';
import { Input, Button, Badge, Select } from '@vera/ui';

interface StoredEvent {
  id: string;
  type: string;
  eventVersion: number;
  source: string;
  personId: string | null;
  subject: Record<string, unknown>;
  contact: Record<string, unknown>;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
  occurredAt: string;
}

interface Contract {
  eventVersion: number;
  types: string[];
  sources: string[];
}

const SOURCE_TONE: Record<string, 'primary' | 'muted' | 'default'> = {
  arturito: 'primary', website: 'default', crm: 'muted', app: 'muted', system: 'muted',
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

/** Event Log — vista TÉCNICA del Conversation Event Pipeline (dev/debug).
 * Stream inmutable de eventos que consume VERA Core. No es una app de usuario final. */
export const EventLogScreen = () => {
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');

  const { data: contract } = useQuery<Contract>({
    queryKey: ['events-contract'],
    queryFn: async () => (await fetch(`${env.backendUrl}/api/events/contract`)).json(),
    staleTime: 300_000,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (source) p.set('source', source);
    p.set('limit', '200');
    return p.toString();
  }, [type, source]);

  const { data: events = [], isLoading, refetch, isFetching } = useQuery<StoredEvent[]>({
    queryKey: ['events', params],
    queryFn: async () => (await fetch(`${env.backendUrl}/api/events?${params}`)).json().then((d) => d.events),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return events;
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(s));
  }, [events, q]);

  return (
    <div className="vera-screen" data-testid="event-log-screen">
      <div className="vera-eventlog__head">
        <div>
          <h1 className="vera-person__name"><Activity size={22} /> Event Log</h1>
          <p className="vera-person__hint">
            Stream inmutable del Conversation Event Pipeline · contrato v{contract?.eventVersion ?? '—'} · vista técnica (dev/debug)
          </p>
        </div>
        <Button variant="ghost" size="sm" data-testid="events-refresh" onClick={() => refetch()}>
          <RefreshCw size={15} className={isFetching ? 'vera-spin' : ''} /> Actualizar
        </Button>
      </div>

      <div className="vera-toolbar">
        <div className="vera-toolbar__search">
          <Input placeholder="Filtrar por texto (persona, propiedad, payload…)" value={q}
            onChange={(e) => setQ(e.target.value)} data-testid="events-search" aria-label="Filtrar eventos" />
        </div>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value)}
          data-testid="events-type-filter"
          aria-label="Tipo"
          options={[{ value: '', label: 'Todos los tipos' }, ...(contract?.types ?? []).map((t) => ({ value: t, label: t }))]}
        />
        <Select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          data-testid="events-source-filter"
          aria-label="Origen"
          options={[{ value: '', label: 'Todos los orígenes' }, ...(contract?.sources ?? []).map((s) => ({ value: s, label: s }))]}
        />
      </div>

      <p className="vera-people__count" data-testid="events-count">{filtered.length} eventos</p>

      {isLoading ? (
        <p className="vera-people__empty">Cargando eventos…</p>
      ) : filtered.length === 0 ? (
        <p className="vera-people__empty" data-testid="events-empty">Sin eventos para estos filtros.</p>
      ) : (
        <div className="vera-eventlog" data-testid="events-list">
          {filtered.map((e) => (
            <div key={e.id} className="vera-event" data-testid={`event-${e.id}`}>
              <div className="vera-event__top">
                <span className="vera-event__type">{e.type}</span>
                <Badge tone={SOURCE_TONE[e.source] ?? 'muted'}>{e.source}</Badge>
                <span className="vera-event__ver">v{e.eventVersion}</span>
                <span className="vera-event__time">{fmt(e.occurredAt)}</span>
              </div>
              <div className="vera-event__meta">
                {e.personId && <span>person: <code>{e.personId.slice(0, 8)}</code></span>}
                {(e.subject?.property_code as string) && <span>prop: <code>{e.subject.property_code as string}</code></span>}
                {e.idempotencyKey && <span>idem: <code>{e.idempotencyKey}</code></span>}
              </div>
              {Object.keys(e.payload || {}).length > 0 && (
                <pre className="vera-event__payload">{JSON.stringify(e.payload, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventLogScreen;
