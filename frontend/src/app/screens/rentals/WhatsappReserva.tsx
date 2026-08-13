import { MessageCircle } from 'lucide-react';
import { waLink, mensajeReserva, type Reservation } from './api';

/** Botón click-to-send: abre WhatsApp con el mensaje de la reserva ya escrito. */
export const WhatsappReserva = ({ reserva }: { reserva: Reservation }) => {
  if (!reserva.huesped?.telefono) return null;
  return (
    <a className="rt-mini rt-mini--wa" href={waLink(reserva.huesped.telefono, mensajeReserva(reserva))}
      target="_blank" rel="noreferrer" data-testid={`rt-wa-${reserva.id}`}>
      <MessageCircle size={14} /> WhatsApp
    </a>
  );
};

export default WhatsappReserva;
