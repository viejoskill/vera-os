import { useEffect, useState } from 'react';
import { CalendarCheck, X, AlertTriangle, Users, CheckCircle2, Pencil } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, fmtDate, nightsBetween, parseISO, iso, type Reservation, type Occupied } from './api';
import { RentalCalendar } from './RentalCalendar';
import { EditarHuesped } from './EditarHuesped';

/** Vista previa del calendario al confirmar una reserva, con aviso de "días perdidos". */
export const ConfirmarReserva = ({ reserva, onConfirmed, onClose }: {
  reserva: Reservation; onConfirmed: () => void; onClose: () => void;
}) => {
  const [ocupados, setOcupados] = useState<Occupied[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [huesped, setHuesped] = useState(reserva.huesped);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.calendar(reserva.propertyId).then((d) => setOcupados(d.ocupados)).catch(() => setOcupados([])).finally(() => setLoading(false));
  }, [reserva.propertyId]);

  // Huecos cortos (1-2 noches) entre esta reserva y las vecinas = "días perdidos".
  const otros = ocupados.filter((o) => !(o.checkIn === reserva.checkIn && o.checkOut === reserva.checkOut));
  const avisos: string[] = [];
  const antes = otros.filter((o) => o.checkOut <= reserva.checkIn).sort((a, b) => (a.checkOut < b.checkOut ? 1 : -1))[0];
  if (antes) { const g = nightsBetween(antes.checkOut, reserva.checkIn); if (g >= 1 && g <= 2) avisos.push(`Quedan ${g} noche${g > 1 ? 's' : ''} libres antes del check-in (${fmtDate(antes.checkOut)} → ${fmtDate(reserva.checkIn)}), difíciles de alquilar.`); }
  const despues = otros.filter((o) => o.checkIn >= reserva.checkOut).sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1))[0];
  if (despues) { const g = nightsBetween(reserva.checkOut, despues.checkIn); if (g >= 1 && g <= 2) avisos.push(`Quedan ${g} noche${g > 1 ? 's' : ''} libres después del check-out (${fmtDate(reserva.checkOut)} → ${fmtDate(despues.checkIn)}), difíciles de alquilar.`); }

  // Arranca un mes antes para que se vean también las reservas del mes previo.
  const ci = parseISO(reserva.checkIn);
  const startPrev = iso(new Date(ci.getFullYear(), ci.getMonth() - 1, 1));

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
          <div><strong>{huesped?.nombre || 'Sin nombre'}</strong> · <Users size={13} /> {huesped?.huespedes || 1} huéspedes</div>
          <div>{fmtDate(reserva.checkIn)} → {fmtDate(reserva.checkOut)} · <strong>{reserva.noches} noches</strong></div>
          <div>Total estimado: <strong>{fmtMoney(reserva.montoEstimado, reserva.moneda)}</strong></div>
          <button type="button" className="rt-mini" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => setEditing(true)} data-testid={`rt-confirm-edit-huesped-${reserva.id}`}>
            <Pencil size={13} /> Editar datos del huésped
          </button>
        </div>

        {avisos.length > 0 && (
          <div className="rt-confirm__warn" data-testid="rt-confirm-warn">
            <AlertTriangle size={16} />
            <div>{avisos.map((a) => <p key={a}>{a}</p>)}</div>
          </div>
        )}

        <p className="rt-modal__sub">Verificá las fechas pedidas (en <strong style={{ color: '#e0a63c' }}>ámbar</strong>) y las reservas existentes (en <strong style={{ color: '#e07575' }}>rojo</strong>) antes de confirmar:</p>
        {loading ? <p className="rt__loading">Cargando calendario…</p> : (
          <>
            <RentalCalendar
              ocupados={otros}
              value={{ checkIn: reserva.checkIn, checkOut: reserva.checkOut }}
              onChange={() => {}}
              months={3} readOnly startDate={startPrev} className="rt-cal--review"
            />
            <div className="rt-cal__legend" data-testid="rt-confirm-legend">
              <span><i className="rt-lg rt-lg--review" /> Esta pre-reserva</span>
              <span><i className="rt-lg rt-lg--reserva" /> Reserva existente</span>
              <span><i className="rt-lg rt-lg--bloqueo" /> Bloqueo manual</span>
            </div>
          </>
        )}

        <p className="rt-modal__sub" style={{ marginTop: 12 }}>Al confirmar se genera automáticamente el <strong>link de seña</strong> (Mercado Pago). La reserva queda <strong>“Esperando seña”</strong> hasta que el huésped pague.</p>
        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={confirmar} disabled={saving} data-testid={`rt-confirm-do-${reserva.id}`}>
            <CheckCircle2 size={16} /> {saving ? 'Confirmando…' : 'Confirmar y generar seña'}
          </Button>
        </div>
      </div>
      {editing && (
        <EditarHuesped reserva={{ ...reserva, huesped }} onClose={() => setEditing(false)}
          onDone={(r) => { setHuesped(r.huesped); setEditing(false); }} />
      )}
    </div>
  );
};

export default ConfirmarReserva;
