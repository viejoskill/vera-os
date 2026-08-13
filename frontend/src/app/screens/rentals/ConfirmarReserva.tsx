import { useEffect, useState } from 'react';
import { CalendarCheck, X, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, nightsBetween, type Reservation, type Occupied } from './api';
import { RentalCalendar } from './RentalCalendar';

/** Vista previa del calendario al confirmar una reserva, con aviso de "días perdidos". */
export const ConfirmarReserva = ({ reserva, onConfirmed, onClose }: {
  reserva: Reservation; onConfirmed: () => void; onClose: () => void;
}) => {
  const [ocupados, setOcupados] = useState<Occupied[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.calendar(reserva.propertyId).then((d) => setOcupados(d.ocupados)).catch(() => setOcupados([])).finally(() => setLoading(false));
  }, [reserva.propertyId]);

  // Huecos cortos (1-2 noches) entre esta reserva y las vecinas = "días perdidos".
  const otros = ocupados.filter((o) => !(o.checkIn === reserva.checkIn && o.checkOut === reserva.checkOut));
  const avisos: string[] = [];
  const antes = otros.filter((o) => o.checkOut <= reserva.checkIn).sort((a, b) => (a.checkOut < b.checkOut ? 1 : -1))[0];
  if (antes) { const g = nightsBetween(antes.checkOut, reserva.checkIn); if (g >= 1 && g <= 2) avisos.push(`Quedan ${g} noche${g > 1 ? 's' : ''} libres antes del check-in (${antes.checkOut} → ${reserva.checkIn}), difíciles de alquilar.`); }
  const despues = otros.filter((o) => o.checkIn >= reserva.checkOut).sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1))[0];
  if (despues) { const g = nightsBetween(reserva.checkOut, despues.checkIn); if (g >= 1 && g <= 2) avisos.push(`Quedan ${g} noche${g > 1 ? 's' : ''} libres después del check-out (${reserva.checkOut} → ${despues.checkIn}), difíciles de alquilar.`); }

  const confirmar = async () => {
    setSaving(true);
    try { await api.setStatus(reserva.id, 'confirmada'); onConfirmed(); }
    finally { setSaving(false); }
  };

  return (
    <div className="rt-modal" data-testid={`rt-confirm-modal-${reserva.id}`} onClick={onClose}>
      <div className="rt-modal__box rt-modal__box--lg" onClick={(e) => e.stopPropagation()}>
        <div className="rt-modal__head">
          <h3><CalendarCheck size={18} /> Confirmar reserva</h3>
          <button type="button" onClick={onClose} data-testid={`rt-confirm-close-${reserva.id}`}><X size={18} /></button>
        </div>

        <div className="rt-confirm__summary" data-testid="rt-confirm-summary">
          <div><strong>{reserva.huesped.nombre || 'Sin nombre'}</strong> · <Users size={13} /> {reserva.huesped.huespedes || 1} huéspedes</div>
          <div>{reserva.checkIn} → {reserva.checkOut} · <strong>{reserva.noches} noches</strong></div>
          <div>Total estimado: <strong>{fmtMoney(reserva.montoEstimado, reserva.moneda)}</strong></div>
        </div>

        {avisos.length > 0 && (
          <div className="rt-confirm__warn" data-testid="rt-confirm-warn">
            <AlertTriangle size={16} />
            <div>{avisos.map((a) => <p key={a}>{a}</p>)}</div>
          </div>
        )}

        <p className="rt-modal__sub">Verificá las fechas pedidas (marcadas) y las reservas vecinas antes de confirmar:</p>
        {loading ? <p className="rt__loading">Cargando calendario…</p> : (
          <RentalCalendar
            ocupados={ocupados}
            value={{ checkIn: reserva.checkIn, checkOut: reserva.checkOut }}
            onChange={() => {}}
            months={2} readOnly legend startDate={reserva.checkIn}
          />
        )}

        <p className="rt-modal__sub" style={{ marginTop: 12 }}>Al confirmar se genera automáticamente el <strong>link de seña</strong> (Mercado Pago). La reserva queda <strong>“Esperando seña”</strong> hasta que el huésped pague.</p>
        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={confirmar} disabled={saving} data-testid={`rt-confirm-do-${reserva.id}`}>
            <CheckCircle2 size={16} /> {saving ? 'Confirmando…' : 'Confirmar y generar seña'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmarReserva;
