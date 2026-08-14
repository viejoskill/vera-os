import { useRef, useState } from 'react';
import { Paperclip, Plus, Trash2, X, FileText } from 'lucide-react';
import { api, fmtDate, type Reservation } from './api';

/** Comprobantes de pago (recibos/transferencias) adjuntos a la ficha de una reserva. */
export const Comprobantes = ({ reserva, onUpdated }: { reserva: Reservation; onUpdated?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [comps, setComps] = useState(reserva.comprobantes || []);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const subir = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try { const r = await api.addComprobante(reserva.id, f); setComps(r.comprobantes || []); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const borrar = async (cid: string) => {
    if (!window.confirm('¿Eliminar este comprobante?')) return;
    await api.deleteComprobante(reserva.id, cid);
    setComps((c) => c.filter((x) => x.id !== cid));
  };
  const cerrar = () => { setOpen(false); onUpdated?.(); };

  return (
    <>
      <button type="button" className="rt-mini" onClick={() => setOpen(true)} data-testid={`rt-comps-btn-${reserva.id}`}>
        <Paperclip size={14} /> Comprobantes{comps.length ? ` (${comps.length})` : ''}
      </button>
      {open && (
        <div className="rt-modal" data-testid={`rt-comps-modal-${reserva.id}`} onClick={cerrar}>
          <div className="rt-modal__box rt-modal__box--sm" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal__head">
              <h3><Paperclip size={18} /> Comprobantes de pago</h3>
              <button type="button" onClick={cerrar} data-testid={`rt-comps-close-${reserva.id}`}><X size={18} /></button>
            </div>
            <p className="rt-modal__sub"><strong>{reserva.huesped?.nombre}</strong> · guardá acá cada recibo o transferencia.</p>
            <div className="rt-comps__list">
              {comps.length === 0 && <p className="rt-hint">Todavía no hay comprobantes cargados.</p>}
              {comps.map((c) => (
                <div className="rt-comps__row" key={c.id} data-testid={`rt-comp-${c.id}`}>
                  <a className="rt-comps__link" href={api.comprobanteItemUrl(reserva.id, c.id)} target="_blank" rel="noreferrer">
                    <FileText size={15} /> {c.nombre || 'Comprobante'}<span>{c.fecha ? fmtDate(c.fecha.slice(0, 10)) : ''}</span>
                  </a>
                  <button type="button" className="rt-comps__del" onClick={() => borrar(c.id)} data-testid={`rt-comp-del-${c.id}`}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => subir(e.target.files?.[0] || null)} data-testid={`rt-comps-file-${reserva.id}`} />
            <button type="button" className="rt-mini rt-mini--ok" onClick={() => fileRef.current?.click()} disabled={busy} data-testid={`rt-comps-add-${reserva.id}`}>
              <Plus size={14} /> {busy ? 'Subiendo…' : 'Adjuntar comprobante'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Comprobantes;
