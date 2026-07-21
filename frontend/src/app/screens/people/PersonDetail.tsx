import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Save, Loader2, Building2,
  MessageSquare, Clock, UserPlus, MessageCircle, KeyRound,
  Handshake, Send, BadgeCheck, Bot, Brain, AlertTriangle,
} from 'lucide-react';
import { Card, Input, Textarea, Button, Badge } from '@vera/ui';
import { PERSON_ROLES, PERSON_ROLE_LABELS, type PersonUpdateInput } from '@vera/types';
import {
  usePerson, useUpdatePerson, usePersonRelations, usePersonConversations, usePersonTimeline,
  usePersonKnowledge,
} from '@app/hooks/usePeople';

type Tab = 'datos' | 'conocimiento' | 'relaciones' | 'conversaciones' | 'timeline';
const TABS: { id: Tab; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'conocimiento', label: '🧠 Conocimiento' },
  { id: 'relaciones', label: 'Relaciones' },
  { id: 'conversaciones', label: 'Conversaciones' },
  { id: 'timeline', label: 'Timeline' },
];

const EVENT_META: Record<string, { label: string; icon: typeof UserPlus }> = {
  PersonCreated: { label: 'Persona creada', icon: UserPlus },
  ConversationStarted: { label: 'Conversación iniciada', icon: MessageCircle },
  PropertyVisited: { label: 'Visitó una propiedad', icon: Building2 },
  PropertyInquiry: { label: 'Consultó una propiedad', icon: MessageSquare },
  OpportunityCreated: { label: 'Se creó una oportunidad', icon: Handshake },
  OfferSent: { label: 'Oferta enviada', icon: Send },
  PropertyReserved: { label: 'Reservó una propiedad', icon: KeyRound },
  PropertySold: { label: 'Propiedad vendida', icon: BadgeCheck },
};

const money = (n: number, c: string) => (n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar');
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** Ficha de Persona (VERA Core). Consulta y administración de la identidad única.
 * Sin lógica comercial: sólo datos, relaciones (lectura), conversaciones y timeline. */
export const PersonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: person, isLoading } = usePerson(id);
  const update = useUpdatePerson(id ?? '');
  const [tab, setTab] = useState<Tab>('datos');

  if (isLoading) return <div className="vera-screen"><p className="vera-people__empty">Cargando persona…</p></div>;
  if (!person) return <div className="vera-screen"><p className="vera-people__empty">Persona no encontrada.</p></div>;

  return (
    <div className="vera-screen" data-testid="person-detail">
      <button type="button" className="vera-back" data-testid="person-back" onClick={() => navigate('/personas')}>
        <ArrowLeft size={15} /> Personas
      </button>

      <header className="vera-person__head">
        <div>
          <h1 className="vera-person__name" data-testid="person-name">{person.fullName}</h1>
          <div className="vera-role-tags">
            {(person.roles || []).map((r) => (
              <span key={r} className="vera-role-tag">{PERSON_ROLE_LABELS[r] ?? r}</span>
            ))}
            <span className={`vera-person__status vera-person__status--${person.status === 'active' ? 'on' : 'off'}`}>
              {person.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          data-testid="person-open-arturito"
          onClick={() => window.open('https://app.arturito.ai', '_blank', 'noopener')}
        >
          <Bot size={15} /> Abrir Arturito
        </Button>
      </header>

      <nav className="vera-tabs" role="tablist" data-testid="person-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`vera-tab ${tab === t.id ? 'vera-tab--active' : ''}`.trim()}
            data-testid={`person-tab-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'datos' && <DatosTab key={person.id} person={person} onSave={(patch) => update.mutateAsync(patch)} saving={update.isPending} />}
      {tab === 'conocimiento' && <ConocimientoTab id={person.id} />}
      {tab === 'relaciones' && <RelacionesTab id={person.id} />}
      {tab === 'conversaciones' && <ConversacionesTab id={person.id} />}
      {tab === 'timeline' && <TimelineTab id={person.id} />}
    </div>
  );
};

// --- Datos -----------------------------------------------------------------
const ChipList = ({ label, values, onChange, placeholder, testid }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; testid: string;
}) => {
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim(); if (v && !values.includes(v)) { onChange([...values, v]); setDraft(''); } };
  return (
    <div className="vera-field">
      <span className="vera-field__label">{label}</span>
      <div className="vera-chiplist" data-testid={testid}>
        {values.map((v, i) => (
          <span key={v} className="vera-chip">
            {v}
            <button type="button" aria-label={`Quitar ${v}`} data-testid={`${testid}-remove-${i}`} onClick={() => onChange(values.filter((x) => x !== v))}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="vera-chiplist__add">
        <Input value={draft} placeholder={placeholder} data-testid={`${testid}-input`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button variant="ghost" size="sm" data-testid={`${testid}-add`} onClick={add}><Plus size={14} /></Button>
      </div>
    </div>
  );
};

const DatosTab = ({ person, onSave, saving }: { person: import('@vera/types').Person; onSave: (p: PersonUpdateInput) => Promise<unknown>; saving: boolean }) => {
  const [fullName, setFullName] = useState(person.fullName);
  const [primaryPhone, setPrimaryPhone] = useState(person.primaryPhone);
  const [primaryEmail, setPrimaryEmail] = useState(person.primaryEmail);
  const [phones, setPhones] = useState<string[]>(person.phones || []);
  const [emails, setEmails] = useState<string[]>(person.emails || []);
  const [document, setDocument] = useState(person.document);
  const [notes, setNotes] = useState(person.notes);
  const [roles, setRoles] = useState<string[]>(person.roles || []);
  const [status, setStatus] = useState(person.status);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSaved(false); }, [fullName, primaryPhone, primaryEmail, phones, emails, document, notes, roles, status]);

  const toggleRole = (r: string) => setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const save = async () => {
    const mergedPhones = primaryPhone && !phones.includes(primaryPhone) ? [primaryPhone, ...phones] : phones;
    const mergedEmails = primaryEmail && !emails.includes(primaryEmail) ? [primaryEmail, ...emails] : emails;
    await onSave({ fullName, primaryPhone, primaryEmail, phones: mergedPhones, emails: mergedEmails, document, notes, roles, status });
    setPhones(mergedPhones); setEmails(mergedEmails); setSaved(true);
  };

  return (
    <div className="vera-person__grid">
      <Card className="vera-person__card">
        <h3 className="vera-person__card-title">Datos</h3>
        <div className="vera-form">
          <Input label="Nombre completo" value={fullName} data-testid="person-fullname" onChange={(e) => setFullName(e.target.value)} />
          <div className="vera-form-grid">
            <Input label="Teléfono principal" value={primaryPhone} data-testid="person-primary-phone" onChange={(e) => setPrimaryPhone(e.target.value)} />
            <Input label="Email principal" value={primaryEmail} data-testid="person-primary-email" onChange={(e) => setPrimaryEmail(e.target.value)} />
          </div>
          <ChipList label="Otros teléfonos" values={phones.filter((p) => p !== primaryPhone)} onChange={setPhones} placeholder="Agregar teléfono…" testid="person-phones" />
          <ChipList label="Otros emails" values={emails.filter((e) => e !== primaryEmail)} onChange={setEmails} placeholder="Agregar email…" testid="person-emails" />
          <Input label="Documento" value={document} data-testid="person-document" onChange={(e) => setDocument(e.target.value)} />
          <Textarea label="Observaciones" rows={3} value={notes} data-testid="person-notes" onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>

      <Card className="vera-person__card">
        <h3 className="vera-person__card-title">Roles</h3>
        <div className="vera-roles" role="group">
          {PERSON_ROLES.map((r) => (
            <button key={r.id} type="button" data-testid={`person-role-${r.id}`} aria-pressed={roles.includes(r.id)}
              className={`vera-role-chip ${roles.includes(r.id) ? 'vera-role-chip--active' : ''}`.trim()}
              onClick={() => toggleRole(r.id)}>{r.label}</button>
          ))}
        </div>

        <h3 className="vera-person__card-title" style={{ marginTop: '20px' }}>Estado</h3>
        <div className="vera-roles">
          <button type="button" data-testid="person-status-active" aria-pressed={status === 'active'}
            className={`vera-role-chip ${status === 'active' ? 'vera-role-chip--active' : ''}`.trim()}
            onClick={() => setStatus('active')}>Activo</button>
          <button type="button" data-testid="person-status-inactive" aria-pressed={status === 'inactive'}
            className={`vera-role-chip ${status === 'inactive' ? 'vera-role-chip--active' : ''}`.trim()}
            onClick={() => setStatus('inactive')}>Inactivo</button>
        </div>

        <div className="vera-person__save">
          <Button variant="primary" size="md" disabled={saving} data-testid="person-save" onClick={save}>
            {saving ? (<><Loader2 size={15} className="vera-spin" /> Guardando…</>) : saved ? (<><BadgeCheck size={15} /> Guardado</>) : (<><Save size={15} /> Guardar cambios</>)}
          </Button>
        </div>
      </Card>
    </div>
  );
};

// --- Relaciones ------------------------------------------------------------
const RelacionesTab = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = usePersonRelations(id);
  if (isLoading) return <p className="vera-people__empty">Cargando relaciones…</p>;
  return (
    <Card className="vera-person__card">
      <h3 className="vera-person__card-title"><Building2 size={16} /> Propiedades</h3>
      {data.length === 0 ? (
        <p className="vera-person__hint" data-testid="relations-empty">Esta persona no tiene propiedades asociadas todavía.</p>
      ) : (
        <div className="vera-rel-list" data-testid="relations-list">
          {data.map((p) => (
            <button key={p.id} type="button" className="vera-rel-item" data-testid={`relation-${p.id}`} onClick={() => navigate(`/propiedades/${p.id}`)}>
              <div>
                <strong>{p.title}</strong>
                <span className="vera-rel-item__meta">{[p.city, money(p.price, p.currency)].filter(Boolean).join(' · ')}</span>
              </div>
              <Badge tone="primary">{PERSON_ROLE_LABELS[p.relation] ?? p.relation}</Badge>
            </button>
          ))}
        </div>
      )}
      <p className="vera-person__hint" style={{ marginTop: '12px' }}>Próximamente: comprador interesado, inquilino, garante.</p>
    </Card>
  );
};

// --- Conversaciones --------------------------------------------------------
const ConversacionesTab = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = usePersonConversations(id);
  if (isLoading) return <p className="vera-people__empty">Cargando conversaciones…</p>;
  return (
    <Card className="vera-person__card">
      <h3 className="vera-person__card-title"><MessageSquare size={16} /> Conversaciones</h3>
      {data.length === 0 ? (
        <p className="vera-person__hint" data-testid="conversations-empty">Sin conversaciones asociadas. Cuando se integre Arturito aparecerán acá.</p>
      ) : (
        <div className="vera-rel-list" data-testid="conversations-list">
          {data.map((c) => (
            <button key={c.id} type="button" className="vera-rel-item" data-testid={`conversation-${c.id}`} onClick={() => navigate('/vera-bot')}>
              <div>
                <strong>{c.propertyLabel || 'Consulta'}</strong>
                <span className="vera-rel-item__meta">{c.preview}</span>
              </div>
              <Badge tone="muted">{c.channel}</Badge>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

// --- Timeline --------------------------------------------------------------
const TimelineTab = ({ id }: { id: string }) => {
  const { data = [], isLoading } = usePersonTimeline(id);
  if (isLoading) return <p className="vera-people__empty">Cargando timeline…</p>;
  if (data.length === 0) return <Card className="vera-person__card"><p className="vera-person__hint" data-testid="timeline-empty">Sin eventos todavía.</p></Card>;
  return (
    <Card className="vera-person__card">
      <h3 className="vera-person__card-title"><Clock size={16} /> Timeline</h3>
      <ol className="vera-timeline" data-testid="timeline-list">
        {data.map((ev) => {
          const meta = EVENT_META[ev.type] ?? { label: ev.type, icon: Clock };
          const Icon = meta.icon;
          return (
            <li key={ev.id} className="vera-timeline__item" data-testid={`timeline-${ev.type}`}>
              <span className="vera-timeline__dot"><Icon size={13} /></span>
              <div className="vera-timeline__body">
                <strong>{meta.label}</strong>
                <span className="vera-timeline__date">{fmtDate(ev.occurredAt)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

const KNOWLEDGE_SECTIONS: { key: keyof import('@vera/types').PersonKnowledge; label: string }[] = [
  { key: 'roles', label: 'Roles' },
  { key: 'relationship', label: 'Relación con Varela' },
  { key: 'interests', label: 'Intereses' },
  { key: 'preferences', label: 'Preferencias' },
  { key: 'facts', label: 'Hechos' },
  { key: 'businessContext', label: 'Contexto de negocio' },
  { key: 'aiTags', label: 'AI Tags' },
];

const factText = (f: import('@vera/types').PersonFact) =>
  f.type === 'budget' ? `${f.currency ?? ''} ${f.value}`.trim() : String(f.value);

const ConocimientoTab = ({ id }: { id: string }) => {
  const { data, isLoading } = usePersonKnowledge(id);
  if (isLoading) return <p className="vera-people__empty">Cargando conocimiento…</p>;
  if (!data || data.factCount === 0) {
    return (
      <Card className="vera-person__card">
        <p className="vera-person__hint" data-testid="knowledge-empty">
          VERA todavía no aprendió nada de esta persona. El conocimiento se genera
          automáticamente a partir de los resúmenes de conversación de Arturito.
        </p>
      </Card>
    );
  }
  const toneLabel = data.confidenceLabel;
  return (
    <div className="vera-knowledge" data-testid="knowledge-tab">
      <Card className="vera-person__card vera-knowledge__summary">
        <div className="vera-knowledge__head">
          <h3 className="vera-person__card-title"><Brain size={16} /> Lo que VERA sabe</h3>
          <span className={`vera-knowledge__conf vera-knowledge__conf--${toneLabel.toLowerCase()}`} data-testid="knowledge-confidence">
            Confianza: {toneLabel}
          </span>
        </div>
        <ul className="vera-knowledge__readable" data-testid="knowledge-readable">
          {data.readable.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {data.lastUpdated && (
          <p className="vera-knowledge__updated">Última actualización: {fmtDate(data.lastUpdated)}</p>
        )}
      </Card>

      {data.needsReview.length > 0 && (
        <Card className="vera-person__card vera-knowledge__review" data-testid="knowledge-review">
          <h3 className="vera-person__card-title"><AlertTriangle size={16} /> Para revisar (contradicciones)</h3>
          <div className="vera-knowledge__facts">
            {data.needsReview.map((f) => (
              <span key={f.id} className="vera-knowledge__fact vera-knowledge__fact--review">
                {f.type}: {factText(f)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card className="vera-person__card">
        <h3 className="vera-person__card-title">Conocimiento estructurado</h3>
        <div className="vera-knowledge__grid">
          {KNOWLEDGE_SECTIONS.map((s) => {
            const items = (data[s.key] as import('@vera/types').PersonFact[]) || [];
            if (!Array.isArray(items) || items.length === 0) return null;
            return (
              <div key={s.key} className="vera-knowledge__section" data-testid={`knowledge-section-${s.key}`}>
                <span className="vera-knowledge__section-title">{s.label}</span>
                <div className="vera-knowledge__facts">
                  {items.map((f) => (
                    <span key={f.id} className={`vera-knowledge__fact ${f.status === 'review' ? 'vera-knowledge__fact--review' : ''}`.trim()}
                      title={`Confianza ${Math.round((f.confidence || 0) * 100)}% · ${f.source}`}>
                      {factText(f)}
                      <em className="vera-knowledge__fact-conf">{Math.round((f.confidence || 0) * 100)}%</em>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default PersonDetail;