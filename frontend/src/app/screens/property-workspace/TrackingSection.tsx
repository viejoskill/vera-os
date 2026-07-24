import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Users, MessageCircle, Plus, Footprints } from 'lucide-react';
import { Button } from '@vera/ui';
import { visitService } from '@vera/services';
import type { PropertyVisit } from '@vera/types';
import { VisitModal } from './VisitModal';

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

export const TrackingSection = ({
  propertyId, address, ownerId,
}: { propertyId: string; address: string; ownerId?: string }) => {
  const { data: visits = [] } = useQuery({
    queryKey: ['visits', propertyId],
    queryFn: () => visitService.list(propertyId),
  });
  const [modalOpen, setModalOpen] = useState(false);

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

      <Button size="md" data-testid="register-visit-btn" onClick={() => setModalOpen(true)}>
        <Plus size={16} /> Registrar visita
      </Button>

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
        <VisitModal propertyId={propertyId} address={address} ownerId={ownerId} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
};
