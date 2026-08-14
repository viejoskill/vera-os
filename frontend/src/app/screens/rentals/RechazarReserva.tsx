import { useState } from 'react';
import { XCircle, X, MessageCircle } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, mensajeRechazo, waLink, fmtDate, type Reservation } from './api';

/** Modal para rechazar/cancelar una reserva y avisarle al huésped por WhatsApp. */
export const RechazarReserva = ({ reserva, onDone, onClose }: {
  reserva: Reservation; onDone: () => void; onClose: () => void;
}) => {
  const [motivo, setMotivo] = useState(reserva.motivo || '');
  const [saving, setSaving] = useState(false);
  const esConfirmada = reserva.estado === 'confirmada';
  const msg = mensajeRechazo(reserva, motivo);

  const rechazar = async (enviarWa: boolean) => {
    setSaving(true);
    try {
      await api.setStatus(reserva.id, 'cancelada', motivo || undefined);
      if (enviarWa && reserva.huesped?.telefono) window.open(waLink(reserva.huesped.telefono, msg), '_blank');
      onDone();
    } finally { setSaving(false); }
  };

  return (
    <div className="rt-modal" data-testid={`rt-reject-modal-${reserva.id}`} onClick={onClose}>
      <div className="rt-modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="rt-modal__head">
          <h3><XCircle size={18} /> {esConfirmada ? 'Cancelar reserva' : 'Rechazar pre-reserva'}</h3>
          <button type="button" onClick={onClose} data-testid={`rt-reject-close-${reserva.id}`}><X size={18} /></button>
        </div>
        <p className="rt-modal__sub"><strong>{reserva.huesped?.nombre}</strong> · {fmtDate(reserva.checkIn)} → {fmtDate(reserva.checkOut)} ({reserva.noches} noches)</p>

        <label className="rt-field"><span>Motivo (opcional — se incluye en el WhatsApp)</span>
          <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: esas fechas ya están reservadas" data-testid={`rt-reject-motivo-${reserva.id}`} /></label>

        <p className="rt-modal__sub" style={{ marginBottom: 6 }}>Vista previa del mensaje al huésped:</p>
        <pre className="rt-reject__preview" data-testid={`rt-reject-preview-${reserva.id}`}>{msg}</pre>

        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Volver</Button>
          <Button variant="secondary" size="md" onClick={() => rechazar(false)} disabled={saving} data-testid={`rt-reject-only-${reserva.id}`}>Solo rechazar</Button>
          {reserva.huesped?.telefono && (
            <Button variant="primary" size="md" onClick={() => rechazar(true)} disabled={saving} data-testid={`rt-reject-wa-${reserva.id}`}>
              <MessageCircle size={16} /> {saving ? 'Procesando…' : 'Rechazar y avisar por WhatsApp'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RechazarReserva;
