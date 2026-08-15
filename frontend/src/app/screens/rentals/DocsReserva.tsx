import { useState } from 'react';
import { FileText, FileSignature } from 'lucide-react';
import { api, waLink, senaAsegurada, type Reservation } from './api';
import { DocPreview } from './DocPreview';

const msgDoc = (r: Reservation, tipo: string, url: string) =>
  `Hola ${r.huesped?.nombre || ''}! Te enviamos tu ${tipo} de Inmobiliaria Varela. Podés descargarlo acá: ${url}`;

/** Botones de documentos (Reserva / Contrato) con vista previa, descarga y envío por WhatsApp. */
export const DocsReserva = ({ reserva }: { reserva: Reservation }) => {
  const [open, setOpen] = useState<'reserva' | 'contrato' | null>(null);
  const confirmada = ['confirmada', 'encurso', 'finalizada'].includes(reserva.estado);
  if (!confirmada) return null;
  const tel = reserva.huesped?.telefono;
  const reservaUrl = api.documentoReservaUrl(reserva.id);
  const contratoUrl = api.documentoContratoUrl(reserva.id);

  return (
    <>
      {senaAsegurada(reserva) && (
        <button type="button" className="rt-mini rt-mini--doc" onClick={() => setOpen('reserva')} data-testid={`rt-doc-reserva-${reserva.id}`} title="Ver documento de reserva">
          <FileText size={14} /> Reserva{reserva.nroReserva ? ` N°${reserva.nroReserva}` : ''}
        </button>
      )}
      <button type="button" className="rt-mini rt-mini--doc" onClick={() => setOpen('contrato')} data-testid={`rt-doc-contrato-${reserva.id}`} title="Ver contrato de locación">
        <FileSignature size={14} /> Contrato{reserva.nroContrato ? ` N°${reserva.nroContrato}` : ''}
      </button>

      {open === 'reserva' && (
        <DocPreview
          title={`Reserva de alquiler${reserva.nroReserva ? ` · N°${reserva.nroReserva}` : ''}`}
          previewUrl={reservaUrl}
          downloadUrl={`${reservaUrl}?dl=1`}
          waHref={tel ? waLink(tel, msgDoc(reserva, 'reserva', reservaUrl)) : undefined}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'contrato' && (
        <DocPreview
          title={`Contrato de locación${reserva.nroContrato ? ` · N°${reserva.nroContrato}` : ''}`}
          previewUrl={contratoUrl}
          downloadUrl={`${contratoUrl}?dl=1`}
          waHref={tel ? waLink(tel, msgDoc(reserva, 'contrato', contratoUrl)) : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
};
