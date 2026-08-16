import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Flame, GitBranch, CheckSquare, MessageCircle, RefreshCw,
  ArrowRight, Check, Building2, Clock, DollarSign, Pencil, Trash2, Plus,
} from 'lucide-react';
import { env } from '@vera/config';
import { Button, Badge } from '@vera/ui';

const API = `${env.backendUrl}/api/core`;
const CONTA = `${env.backendUrl}/api/contabilidad`;
const fmtM = (n: number, m = 'USD') => `${m === 'USD' ? 'US$' : '$'} ${Math.round(n || 0).toLocaleString('es-AR')}`;
const getJson = async (path: string) => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
};

interface Lead { id: string; personId: string; personName: string; status: string; source: string; createdAt: string; }
interface Opp { id: string; personId: string; personName: string; propertyId: string; propertyLabel: string; stage: string; }
interface Task { id: string; personId: string; personName: string; title: string; type: string; propertyLabel: string; }
interface Activity { id: string; at: string; type: string; label: string; personId: string | null; personName: string; source: string; }
interface Kpis { personas: number; leadsActivos: number; oportunidadesAbiertas: number; tareasPendientes: number; conversacionesHoy: number; }
interface Venta { id: string; personId: string; propertyId: string; moneda: string; monto: number; estado: string; }

/** Comisión de venta enganchada a una oportunidad. Naranja mientras está reservada,
 * verde cuando la oportunidad se gana. Sólo se muestra desde la etapa "Reserva". */
const OppCommission = ({ opp, venta, onSave, onDelete }: {
  opp: Opp; venta?: Venta;
  onSave: (opp: Opp, data: { moneda: string; monto: number }) => void;
  onDelete: (v: Venta) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [moneda, setMoneda] = useState(venta?.moneda || 'USD');
  const [monto, setMonto] = useState(venta ? String(venta.monto) : '');
  const show = opp.stage === 'reserva' || opp.stage === 'ganada';
  if (!show && !venta) return null;
  const save = () => { if (!monto) return; onSave(opp, { moneda, monto: Number(monto) }); setEditing(false); };

  if (editing) {
    return (
      <div className="vera-ops__com-form" data-testid={`opp-com-form-${opp.id}`}>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} data-testid={`opp-com-moneda-${opp.id}`}>
          <option value="USD">USD</option><option value="ARS">ARS</option>
        </select>
        <input type="number" placeholder="Comisión" value={monto} autoFocus onChange={(e) => setMonto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} data-testid={`opp-com-monto-${opp.id}`} />
        <button type="button" className="vera-ops__com-save" onClick={save} data-testid={`opp-com-save-${opp.id}`}>Guardar</button>
        <button type="button" className="vera-ops__com-cancel" onClick={() => setEditing(false)}>Cancelar</button>
      </div>
    );
  }
  if (venta) {
    const conf = venta.estado === 'confirmada';
    return (
      <div className="vera-ops__com">
        <span className={`vera-ops__com-chip vera-ops__com-chip--${conf ? 'confirmada' : 'reserva'}`} data-testid={`opp-com-chip-${opp.id}`}>
          <DollarSign size={12} /> {fmtM(venta.monto, venta.moneda)} · {conf ? 'confirmada' : 'reservada'}
        </span>
        <button type="button" className="vera-ops__com-edit" onClick={() => setEditing(true)} data-testid={`opp-com-edit-${opp.id}`}><Pencil size={12} /></button>
        <button type="button" className="vera-ops__com-del" onClick={() => onDelete(venta)} data-testid={`opp-com-del-${opp.id}`}><Trash2 size={12} /></button>
      </div>
    );
  }
  return (
    <div className="vera-ops__com">
      <button type="button" className="vera-ops__com-add" onClick={() => setEditing(true)} data-testid={`opp-com-add-${opp.id}`}>
        <Plus size={12} /> Cargar comisión
      </button>
    </div>
  );
};

const LEAD_STATUS: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', calificado: 'Calificado', convertido: 'Convertido', perdido: 'Perdido',
};
const STATUS_TONE: Record<string, 'primary' | 'default' | 'muted'> = {
  nuevo: 'primary', calificado: 'default', convertido: 'default', contactado: 'muted', perdido: 'muted',
};
const SOURCE_LABEL: Record<string, string> = {
  arturito: 'Arturito', whatsapp: 'WhatsApp', website: 'Web', crm: 'CRM', app: 'App', instagram: 'Instagram',
};
const OPP_FUNNEL = [
  { key: 'interes', label: 'Interesado' },
  { key: 'visita_agendada', label: 'Visita agendada' },
  { key: 'visitada', label: 'Visitada' },
  { key: 'oferta', label: 'Oferta' },
  { key: 'reserva', label: 'Reserva' },
  { key: 'ganada', label: 'Ganada' },
];

const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '');
const dateOf = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return `Hoy ${timeOf(iso)}`;
  if (days === 1) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

/** App "Operaciones" — tablero operativo de VERA. SÓLO visualiza lo que los
 * Projection Handlers de VERA Core generan automáticamente (Leads, Oportunidades,
 * Tareas, Actividad). No decide nada: la inteligencia vive en VERA Core. */
export const OperacionesScreen = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const opts = { refetchInterval: 15_000 } as const;

  const { data: kpis } = useQuery<Kpis>({ queryKey: ['ops', 'kpis'], queryFn: () => getJson('/kpis'), ...opts });
  const { data: leadsRes } = useQuery<{ leads: Lead[] }>({ queryKey: ['ops', 'leads'], queryFn: () => getJson('/leads'), ...opts });
  const { data: oppsRes } = useQuery<{ opportunities: Opp[] }>({ queryKey: ['ops', 'opps'], queryFn: () => getJson('/opportunities'), ...opts });
  const { data: tasksRes } = useQuery<{ tasks: Task[] }>({ queryKey: ['ops', 'tasks'], queryFn: () => getJson('/tasks?status=pendiente'), ...opts });
  const { data: actRes, isFetching, isLoading: actLoading, refetch } = useQuery<{ activity: Activity[] }>({ queryKey: ['ops', 'activity'], queryFn: () => getJson('/activity?limit=40'), ...opts });
  const { data: ventasRes } = useQuery<Venta[]>({ queryKey: ['ops', 'ventas'], queryFn: () => fetch(`${CONTA}/ventas`).then((r) => r.json()), ...opts });

  const saveVenta = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch(`${CONTA}/ventas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'ventas'] }),
  });
  const delVenta = useMutation({
    mutationFn: (id: string) => fetch(`${CONTA}/ventas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'ventas'] }),
  });
  const ventaMap: Record<string, Venta> = {};
  (ventasRes ?? []).forEach((v) => { ventaMap[`${v.personId}__${v.propertyId}`] = v; });
  const handleSaveVenta = (opp: Opp, data: { moneda: string; monto: number }) =>
    saveVenta.mutate({ personId: opp.personId, propertyId: opp.propertyId, propertyLabel: opp.propertyLabel, personName: opp.personName, ...data });
  const handleDelVenta = (v: Venta) => delVenta.mutate(v.id);

  const complete = useMutation({
    mutationFn: (id: string) => fetch(`${API}/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'hecha' }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'tasks'] });
      qc.invalidateQueries({ queryKey: ['ops', 'kpis'] });
    },
  });

  const leads = leadsRes?.leads ?? [];
  const opps = oppsRes?.opportunities ?? [];
  const tasks = tasksRes?.tasks ?? [];
  const activity = actRes?.activity ?? [];

  const kpiCards = [
    { id: 'personas', icon: <Users size={18} />, label: 'Personas', value: kpis?.personas },
    { id: 'leads', icon: <Flame size={18} />, label: 'Leads activos', value: kpis?.leadsActivos },
    { id: 'opps', icon: <GitBranch size={18} />, label: 'Oportunidades abiertas', value: kpis?.oportunidadesAbiertas },
    { id: 'tasks', icon: <CheckSquare size={18} />, label: 'Tareas pendientes', value: kpis?.tareasPendientes },
    { id: 'convs', icon: <MessageCircle size={18} />, label: 'Conversaciones hoy', value: kpis?.conversacionesHoy },
  ];

  return (
    <div className="vera-screen vera-ops" data-testid="operaciones-screen">
      <header className="vera-ops__kpis" data-testid="ops-kpis">
        {kpiCards.map((k) => (
          <div key={k.id} className="vera-ops__kpi" data-testid={`kpi-${k.id}`}>
            <span className="vera-ops__kpi-icon">{k.icon}</span>
            <span className="vera-ops__kpi-value">{k.value ?? '—'}</span>
            <span className="vera-ops__kpi-label">{k.label}</span>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="vera-ops__refresh" data-testid="ops-refresh" onClick={() => refetch()}>
          <RefreshCw size={15} className={isFetching ? 'vera-spin' : ''} />
        </Button>
      </header>

      <div className="vera-ops__board">
        {/* Columna 1 — Nuevos Leads */}
        <section className="vera-ops__col" data-testid="ops-col-leads">
          <h2 className="vera-ops__col-title"><Flame size={15} /> Nuevos Leads <span className="vera-ops__count">{leads.length}</span></h2>
          <div className="vera-ops__list">
            {leads.length === 0 && <p className="vera-ops__empty">Sin leads todavía.</p>}
            {leads.map((l) => (
              <article key={l.id} className="vera-ops__card" data-testid={`lead-card-${l.id}`}>
                <div className="vera-ops__card-top">
                  <span className="vera-ops__card-name">{l.personName || 'Sin nombre'}</span>
                  <Badge tone={STATUS_TONE[l.status] ?? 'muted'}>{LEAD_STATUS[l.status] ?? l.status}</Badge>
                </div>
                <div className="vera-ops__card-meta">
                  <span>{SOURCE_LABEL[l.source] ?? (l.source || '—')}</span>
                  <span className="vera-ops__dot-sep">·</span>
                  <span>{dateOf(l.createdAt)}</span>
                </div>
                <Button variant="ghost" size="sm" className="vera-ops__card-btn" data-testid={`lead-ver-persona-${l.id}`}
                  onClick={() => navigate(`/personas/${l.personId}`)}>
                  Ver Persona <ArrowRight size={13} />
                </Button>
              </article>
            ))}
          </div>
        </section>

        {/* Columna 2 — Oportunidades por etapa */}
        <section className="vera-ops__col" data-testid="ops-col-opps">
          <h2 className="vera-ops__col-title"><GitBranch size={15} /> Oportunidades <span className="vera-ops__count">{opps.length}</span></h2>
          <div className="vera-ops__funnel">
            {OPP_FUNNEL.map((stage) => {
              const items = opps.filter((o) => o.stage === stage.key);
              return (
                <div key={stage.key} className="vera-ops__stage" data-testid={`opp-stage-${stage.key}`}>
                  <div className="vera-ops__stage-head">
                    <span>{stage.label}</span><span className="vera-ops__count">{items.length}</span>
                  </div>
                  {items.map((o) => (
                    <article key={o.id} className="vera-ops__card vera-ops__card--opp" data-testid={`opp-card-${o.id}`}>
                      <div className="vera-ops__card-top">
                        <span className="vera-ops__card-name">{o.personName || 'Sin nombre'}</span>
                      </div>
                      <div className="vera-ops__card-meta"><Building2 size={12} /> {o.propertyLabel || 'Propiedad'}</div>
                      <OppCommission opp={o} venta={ventaMap[`${o.personId}__${o.propertyId}`]} onSave={handleSaveVenta} onDelete={handleDelVenta} />
                      {o.propertyId && (
                        <Button variant="ghost" size="sm" className="vera-ops__card-btn" data-testid={`opp-abrir-propiedad-${o.id}`}
                          onClick={() => navigate(`/propiedades/${o.propertyId}`)}>
                          Abrir Propiedad <ArrowRight size={13} />
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {/* Columna 3 — Tareas pendientes */}
        <section className="vera-ops__col" data-testid="ops-col-tasks">
          <h2 className="vera-ops__col-title"><CheckSquare size={15} /> Tareas <span className="vera-ops__count">{tasks.length}</span></h2>
          <div className="vera-ops__list">
            {tasks.length === 0 && <p className="vera-ops__empty">Nada pendiente. 🎉</p>}
            {tasks.map((t) => (
              <article key={t.id} className="vera-ops__card vera-ops__task" data-testid={`task-card-${t.id}`}>
                <button type="button" className="vera-ops__check" data-testid={`task-complete-${t.id}`}
                  disabled={complete.isPending} onClick={() => complete.mutate(t.id)} aria-label="Completar tarea">
                  <Check size={14} />
                </button>
                <div className="vera-ops__task-body">
                  <span className="vera-ops__card-name">{t.title}</span>
                  {t.personName && (
                    <button type="button" className="vera-ops__task-person" data-testid={`task-ver-persona-${t.id}`}
                      onClick={() => navigate(`/personas/${t.personId}`)}>{t.personName}</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Columna 4 — Actividad reciente (timeline global) */}
        <section className="vera-ops__col" data-testid="ops-col-activity">
          <h2 className="vera-ops__col-title"><Clock size={15} /> Actividad reciente</h2>
          <div className="vera-ops__timeline">
            {actLoading ? (
              <p className="vera-ops__empty">Cargando actividad…</p>
            ) : activity.length === 0 ? (
              <p className="vera-ops__empty">Todavía no pasó nada.</p>
            ) : activity.map((a) => (
              <div key={a.id} className="vera-ops__event" data-testid={`activity-${a.id}`}>
                <span className="vera-ops__event-time">{timeOf(a.at)}</span>
                <span className="vera-ops__event-node" />
                <div className="vera-ops__event-body">
                  <span className="vera-ops__event-label">{a.label}</span>
                  {a.personName && <span className="vera-ops__event-person">{a.personName}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OperacionesScreen;
