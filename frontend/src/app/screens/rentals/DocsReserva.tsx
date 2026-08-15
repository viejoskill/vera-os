import { FileText, FileSignature } from 'lucide-react';
import { api, senaAsegurada, type Reservation } from './api';

/** Descarga de documentos: Reserva (al formalizar la seña) y Contrato (para firmar en el ingreso). */
export const DocsReserva = ({ reserva }: { reserva: Reservation }) => {
  const confirmada = ['confirmada', 'encurso', 'finalizada'].includes(reserva.estado);
  if (!confirmada) return null;
  return (
    <>
      {senaAsegurada(reserva) && (
        <a className="rt-mini rt-mini--doc" href={api.documentoReservaUrl(reserva.id)} target="_blank" rel="noreferrer" data-testid={`rt-doc-reserva-${reserva.id}`} title="Documento de reserva (PDF)">
          <FileText size={14} /> Reserva PDF{reserva.nroReserva ? ` N°${reserva.nroReserva}` : ''}
        </a>
      )}
      <a className="rt-mini rt-mini--doc" href={api.documentoContratoUrl(reserva.id)} target="_blank" rel="noreferrer" data-testid={`rt-doc-contrato-${reserva.id}`} title="Contrato de locación (PDF)">
        <FileSignature size={14} /> Contrato PDF{reserva.nroContrato ? ` N°${reserva.nroContrato}` : ''}
      </a>
    </>
  );
};
