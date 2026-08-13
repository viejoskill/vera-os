import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, iso, parseISO, type Occupied } from './api';

interface Props {
  ocupados: Occupied[];
  value: { checkIn: string | null; checkOut: string | null };
  onChange: (v: { checkIn: string | null; checkOut: string | null }) => void;
  months?: number;
}

const WD = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Calendario de rango estilo Airbnb. Marca noches ocupadas y evita cruzarlas. */
export const RentalCalendar = ({ ocupados, value, onChange, months = 1 }: Props) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const blocked = useMemo(() => {
    const s = new Set<string>();
    ocupados.forEach((o) => {
      let d = parseISO(o.checkIn); const end = parseISO(o.checkOut);
      while (d < end) { s.add(iso(d)); d = addDays(d, 1); }
    });
    return s;
  }, [ocupados]);

  const rangeHasBlocked = (a: string, b: string) => {
    let d = parseISO(a); const end = parseISO(b);
    while (d < end) { if (blocked.has(iso(d))) return true; d = addDays(d, 1); }
    return false;
  };

  const click = (day: Date) => {
    const s = iso(day);
    if (day < today || blocked.has(s)) return;
    const { checkIn, checkOut } = value;
    if (!checkIn || checkOut || s <= checkIn) { onChange({ checkIn: s, checkOut: null }); return; }
    if (rangeHasBlocked(checkIn, s)) { onChange({ checkIn: s, checkOut: null }); return; }
    onChange({ checkIn, checkOut: s });
  };

  const renderMonth = (base: Date) => {
    const y = base.getFullYear(); const m = base.getMonth();
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7; // lunes = 0
    const days = new Date(y, m + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= days; d += 1) cells.push(new Date(y, m, d));
    return (
      <div className="rt-cal__month" key={`${y}-${m}`}>
        <div className="rt-cal__mtitle">{MES[m]} {y}</div>
        <div className="rt-cal__wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="rt-cal__grid">
          {cells.map((day, i) => {
            if (!day) return <span key={i} className="rt-cal__cell rt-cal__cell--empty" />;
            const s = iso(day);
            const past = day < today;
            const isBlk = blocked.has(s);
            const isIn = value.checkIn === s;
            const isOut = value.checkOut === s;
            const inRange = value.checkIn && value.checkOut && s > value.checkIn && s < value.checkOut;
            const cls = ['rt-cal__cell'];
            if (past) cls.push('rt-cal__cell--past');
            else if (isBlk) cls.push('rt-cal__cell--blocked');
            if (isIn || isOut) cls.push('rt-cal__cell--edge');
            if (inRange) cls.push('rt-cal__cell--range');
            return (
              <button type="button" key={i} className={cls.join(' ')} disabled={past || isBlk}
                onClick={() => click(day)} data-testid={`rt-day-${s}`}>
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const list = Array.from({ length: months }, (_, i) => new Date(view.getFullYear(), view.getMonth() + i, 1));
  const prevDisabled = view.getFullYear() === today.getFullYear() && view.getMonth() <= today.getMonth();

  return (
    <div className="rt-cal" data-testid="rental-calendar">
      <div className="rt-cal__nav">
        <button type="button" disabled={prevDisabled} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} data-testid="rt-cal-prev"><ChevronLeft size={16} /></button>
        <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} data-testid="rt-cal-next"><ChevronRight size={16} /></button>
      </div>
      <div className="rt-cal__months">{list.map(renderMonth)}</div>
    </div>
  );
};

export default RentalCalendar;
