import { FileText, FileSignature, MessageCircle } from 'lucide-react';
import { api, waLink, senaAsegurada, type Reservation } from './api';

const msgDoc = (r: Reservation, tipo: string, url: string) =>
  `Hola ${r.huesped?.nombre || ''}! Te enviamos tu ${tipo} de Inmobiliaria Varela. Podés descargarlo acá: ${url}`;

/** Descarga y envío de documentos: Reserva (al formalizar la seña) y Contrato (para firmar en el ingreso). */
export const DocsReserva = ({ reserva }: { reserva: Reservation }) => {
  const confirmada = ['confirmada', 'encurso', 'finalizada'].includes(reserva.estado);
  if (!confirmada) return null;
  const tel = reserva.huesped?.telefono;
  const reservaUrl = api.documentoReservaUrl(reserva.id);
  const contratoUrl = api.documentoContratoUrl(reserva.id);
  return (
    <>
      {senaAsegurada(reserva) && (
        <>
          <a className="rt-mini rt-mini--doc" href={reservaUrl} target="_blank" rel="noreferrer" data-testid={`rt-doc-reserva-${reserva.id}`} title="Documento de reserva (PDF)">
            <FileText size={14} /> Reserva PDF{reserva.nroReserva ? ` N°${reserva.nroReserva}` : ''}
          </a>
          {tel && (
            <a className="rt-mini rt-mini--wa" href={waLink(tel, msgDoc(reserva, 'reserva', reservaUrl))} target="_blank" rel="noreferrer" data-testid={`rt-doc-reserva-wa-${reserva.id}`} title="Enviar reserva por WhatsApp">
              <MessageCircle size={14} /> Reserva x WhatsApp
            </a>
          )}
        </>
      )}
      <a className="rt-mini rt-mini--doc" href={contratoUrl} target="_blank" rel="noreferrer" data-testid={`rt-doc-contrato-${reserva.id}`} title="Contrato de locación (PDF)">
        <FileSignature size={14} /> Contrato PDF{reserva.nroContrato ? ` N°${reserva.nroContrato}` : ''}
      </a>
      {tel && (
        <a className="rt-mini rt-mini--wa" href={waLink(tel, msgDoc(reserva, 'contrato', contratoUrl))} target="_blank" rel="noreferrer" data-testid={`rt-doc-contrato-wa-${reserva.id}`} title="Enviar contrato por WhatsApp">
          <MessageCircle size={14} /> Contrato x WhatsApp
        </a>
      )}
    </>
  );
};
