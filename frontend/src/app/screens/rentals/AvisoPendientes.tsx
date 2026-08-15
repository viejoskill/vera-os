import { AlertTriangle, ChevronRight } from 'lucide-react';
import { reservasPendientesProximas, procesoReserva, daysUntil, diasTexto, fmtDate, type Reservation } from './api';

/** Aviso destacado: reservas próximas cuya seña todavía no está asegurada. */
export const AvisoPendientes = ({ reservas, onVer }: { reservas: Reservation[]; onVer?: (r: Reservation) => void }) => {
  const pend = reservasPendientesProximas(reservas);
  if (pend.length === 0) return null;
  const hayUrgentes = pend.some((r) => { const d = daysUntil(r.checkIn); return d !== null && d <= 7; });
  return (
    <div className={`rt-aviso ${hayUrgentes ? 'is-urgent' : ''}`} data-testid="rt-aviso-pendientes">
      <div className="rt-aviso__head">
        <AlertTriangle size={18} />
        <strong data-testid="rt-aviso-count">
          {pend.length} reserva{pend.length > 1 ? 's' : ''} próxima{pend.length > 1 ? 's' : ''} con pagos pendientes
        </strong>
      </div>
      <ul className="rt-aviso__list">
        {pend.map((r) => {
          const p = procesoReserva(r);
          const dias = daysUntil(r.checkIn);
          const urgente = dias !== null && dias <= 7;
          return (
            <li
              key={r.id}
              className={`rt-aviso__row ${onVer ? 'is-clickable' : ''}`}
              onClick={onVer ? () => onVer(r) : undefined}
              data-testid={`rt-aviso-${r.id}`}
            >
              <span className={`rt-aviso__when ${urgente ? 'is-urgent' : ''}`}>{diasTexto(dias)}</span>
              <span className="rt-aviso__nom">
                <strong>{r.huesped.nombre || 'Sin nombre'}</strong>
                <em>{r.propertyTitulo}</em>
              </span>
              <span className="rt-aviso__dates">{fmtDate(r.checkIn)}</span>
              <span className="rt-aviso__falta">{p.falta}</span>
              {onVer && <ChevronRight size={16} className="rt-aviso__chev" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
