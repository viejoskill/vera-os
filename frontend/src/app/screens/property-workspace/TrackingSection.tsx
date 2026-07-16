import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Users, MessageCircle, Plus, Copy, Check, X, Footprints } from 'lucide-react';
import { Button, Input, Textarea } from '@vera/ui';
import { visitService, buildOwnerMessage } from '@vera/services';
import type { PropertyVisit, VisitInput } from '@vera/types';

const todayISO = () => new Date().toISOString().slice(0, 10);

function relativeDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return `Hace ${diff} días`;
}

interface TimelineEntry {
  key: string;
  date: string;
  time: string;
  kind: 'visit' | 'whatsapp';
  interested?: string;
}

const emptyForm: VisitInput = {
  date: todayISO(),
  time: '',
  interested: '',
  agent: '',
  comment: '',
  notifyOwner: true,
};

export const TrackingSection = ({ propertyId, address }: { propertyId: string; address: string }) => {
  const queryClient = useQueryClient();
  const { data: visits = [] } = useQuery({
    queryKey: ['visits', propertyId],
    queryFn: () => visitService.list(propertyId),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<VisitInput>(emptyForm);
  const [ownerMessage, setOwnerMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: VisitInput) => visitService.create(propertyId, input),
    onSuccess: async (_visit, input) => {
      await queryClient.invalidateQueries({ queryKey: ['visits', propertyId] });
      setModalOpen(false);
      setOwnerMessage(buildOwnerMessage({ address, comment: input.comment }));
      setCopied(false);
      setForm(emptyForm);
    },
  });

  const stats = useMemo(() => {
    const lastVisit = visits[0]?.date ?? '';
    const lastOwner = visits.find((v) => v.notifyOwner)?.date ?? '';
    return {
      count: visits.length,
      lastVisit: lastVisit ? relativeDay(lastVisit) : 'Sin visitas aún',
      lastOwner: lastOwner ? relativeDay(lastOwner) : 'Sin contacto aún',
    };
  }, [visits]);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];
    visits.forEach((v: PropertyVisit) => {
      entries.push({ key: `${v.id}-v`, date: v.date, time: v.time, kind: 'visit', interested: v.interested });
      if (v.notifyOwner) entries.push({ key: `${v.id}-w`, date: v.date, time: v.time, kind: 'whatsapp' });
    });
    return entries.sort((a, b) => (`${a.date} ${a.time}` < `${b.date} ${b.time}` ? 1 : -1));
  }, [visits]);

  const update = (patch: Partial<VisitInput>) => setForm((f) => ({ ...f, ...patch }));

  const copyMessage = async () => {
    if (!ownerMessage) return;
    try {
      await navigator.clipboard.writeText(ownerMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="vera-tracking" data-testid="tracking-section">
      <div className="vera-tracking__stats">
        <div className="vera-stat" data-testid="stat-last-visit">
          <span className="vera-stat__label"><CalendarDays size={14} /> Última visita</span>
          <span className="vera-stat__value">{stats.lastVisit}</span>
        </div>
        <div className="vera-stat" data-testid="stat-last-owner">
          <span className="vera-stat__label"><MessageCircle size={14} /> Último contacto con propietario</span>
          <span className="vera-stat__value">{stats.lastOwner}</span>
        </div>
        <div className="vera-stat" data-testid="stat-visits-count">
          <span className="vera-stat__label"><Footprints size={14} /> Visitas</span>
          <span className="vera-stat__value">{stats.count}</span>
        </div>
        <div className="vera-stat" data-testid="stat-inquiries-count">
          <span className="vera-stat__label"><Users size={14} /> Consultas</span>
          <span className="vera-stat__value vera-stat__value--muted">—</span>
        </div>
      </div>

      <Button size="md" data-testid="register-visit-btn" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
        <Plus size={16} /> Registrar visita
      </Button>

      {ownerMessage && (
        <div className="vera-owner-msg" data-testid="owner-message">
          <span className="vera-field__label">Mensaje para el propietario</span>
          <p className="vera-owner-msg__text">{ownerMessage}</p>
          <Button variant="secondary" size="sm" data-testid="copy-message-btn" onClick={copyMessage}>
            {copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar mensaje</>}
          </Button>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="vera-timeline" data-testid="visit-timeline">
          {timeline.map((e) => (
            <div className="vera-timeline__item" key={e.key}>
              <span className="vera-timeline__dot" />
              <div className="vera-timeline__body">
                <span className="vera-timeline__when">{relativeDay(e.date)}</span>
                {e.kind === 'visit' ? (
                  <span className="vera-timeline__what">
                    Visita realizada{e.interested ? ` · ${e.interested}` : ''}
                  </span>
                ) : (
                  <span className="vera-timeline__what">WhatsApp enviado al propietario</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="vera-modal" role="dialog" aria-modal="true" data-testid="visit-modal">
          <div className="vera-modal__backdrop" onClick={() => setModalOpen(false)} />
          <div className="vera-modal__panel">
            <div className="vera-modal__head">
              <h3 className="vera-modal__title">Registrar visita</h3>
              <button type="button" className="vera-modal__close" aria-label="Cerrar" data-testid="visit-modal-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="vera-modal__body">
              <div className="vera-form-grid">
                <Input label="Fecha" type="date" data-testid="visit-date" value={form.date} onChange={(e) => update({ date: e.target.value })} />
                <Input label="Hora" type="time" data-testid="visit-time" value={form.time} onChange={(e) => update({ time: e.target.value })} />
              </div>
              <Input label="Interesado" placeholder="Ej.: Juan García" data-testid="visit-interested" value={form.interested} onChange={(e) => update({ interested: e.target.value })} />
              <Input label="Agente" placeholder="Ej.: Sofía Martín" data-testid="visit-agent" value={form.agent} onChange={(e) => update({ agent: e.target.value })} />
              <Textarea label="Comentario interno" placeholder="Qué se conversó, impresiones, próximos pasos…" data-testid="visit-comment" value={form.comment} onChange={(e) => update({ comment: e.target.value })} />
              <label className="vera-checkbox" data-testid="visit-notify">
                <input type="checkbox" checked={form.notifyOwner} onChange={(e) => update({ notifyOwner: e.target.checked })} />
                Avisar al propietario por WhatsApp
              </label>
            </div>
            <div className="vera-modal__foot">
              <Button variant="ghost" size="md" data-testid="visit-cancel" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" size="md" data-testid="visit-submit" disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
                {mutation.isPending ? 'Registrando…' : 'Registrar visita'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
