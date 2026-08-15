import { useState } from 'react';
import { Wallet, X, Check, Trash2, Paperclip, FileDown } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, fmtDate, saldoPendiente, senaAsegurada, type Reservation } from './api';

const METODO_LABEL: Record<string, string> = {
  transferencia: 'Transferencia', efectivo: 'Efectivo', otro: 'Otro',
};

/** Cobro de saldo: se muestra recién cuando la seña está asegurada (confirmada + seña pagada). */
export const CobrarSaldo = ({ reserva, onUpdated }: { reserva: Reservation; onUpdated?: () => void }) => {
  const [open, setOpen] = useState(false);
  if (!senaAsegurada(reserva)) return null;

  const pend = saldoPendiente(reserva);
  const saldos = reserva.saldos || [];

  if (pend <= 0) {
    return (
      <span className="rt-pay rt-pay--ok" data-testid={`rt-saldo-ok-${reserva.id}`}>
        <Check size={13} /> Saldo cobrado · total {fmtMoney(reserva.montoEstimado, reserva.moneda)}
      </span>
    );
  }

  return (
    <>
      <span className="rt-pay rt-pay--pend" data-testid={`rt-saldo-pend-${reserva.id}`}>
        <Wallet size={13} /> Saldo pendiente · {fmtMoney(pend, reserva.moneda)}
      </span>
      <button type="button" className="rt-mini rt-mini--pay" onClick={() => setOpen(true)} data-testid={`rt-saldo-btn-${reserva.id}`}>
        <Wallet size={14} /> Cobrar saldo
      </button>
      {saldos.length > 0 && (
        <span className="rt-saldo__list" data-testid={`rt-saldo-list-${reserva.id}`}>
          {saldos.map((s) => (
            <span key={s.id} className="rt-saldo__chip" data-testid={`rt-saldo-item-${s.id}`}>
              {fmtMoney(s.monto, reserva.moneda)} · {METODO_LABEL[s.metodo] || s.metodo}{s.fecha ? ` · ${fmtDate(s.fecha)}` : ''}
              <a className="rt-saldo__ic" href={api.reciboSaldoUrl(reserva.id, s.id)} target="_blank" rel="noreferrer" title="Recibo PDF" data-testid={`rt-saldo-recibo-${s.id}`}><FileDown size={12} /></a>
              {s.comprobanteId && (
                <a className="rt-saldo__ic" href={api.comprobanteItemUrl(reserva.id, s.comprobanteId)} target="_blank" rel="noreferrer" title="Ver comprobante" data-testid={`rt-saldo-comp-${s.id}`}><Paperclip size={12} /></a>
              )}
              <button type="button" className="rt-saldo__del" onClick={async () => { await api.deleteSaldo(reserva.id, s.id); onUpdated?.(); }} title="Quitar" data-testid={`rt-saldo-del-${s.id}`}><Trash2 size={11} /></button>
            </span>
          ))}
        </span>
      )}
      {open && (
        <SaldoModal
          reserva={reserva}
          sugerido={pend}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); onUpdated?.(); }}
        />
      )}
    </>
  );
};

const SaldoModal = ({ reserva, sugerido, onClose, onDone }: {
  reserva: Reservation; sugerido: number; onClose: () => void; onDone: () => void;
}) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const [monto, setMonto] = useState(String(sugerido || ''));
  const [metodo, setMetodo] = useState('transferencia');
  const [fecha, setFecha] = useState(hoy);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const guardar = async () => {
    const n = Number(monto);
    if (!n || n <= 0) { setErr('Ingresá el monto cobrado.'); return; }
    setErr(''); setSaving(true);
    try { await api.cobrarSaldo(reserva.id, n, metodo, fecha, file); onDone(); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div className="rt-modal" data-testid={`rt-saldo-modal-${reserva.id}`} onClick={onClose}>
      <div className="rt-modal__box rt-modal__box--sm" onClick={(e) => e.stopPropagation()}>
        <div className="rt-modal__head">
          <h3><Wallet size={18} /> Cobrar saldo</h3>
          <button type="button" onClick={onClose} data-testid={`rt-saldo-close-${reserva.id}`}><X size={18} /></button>
        </div>
        <p className="rt-modal__sub">
          Registrá el pago del saldo (el día antes de viajar o al ingresar). Total de la reserva: <strong>{fmtMoney(reserva.montoEstimado, reserva.moneda)}</strong> · Saldo pendiente: <strong>{fmtMoney(sugerido, reserva.moneda)}</strong>.
        </p>
        <label className="rt-field"><span>Monto cobrado ({reserva.moneda})</span>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} data-testid={`rt-saldo-monto-${reserva.id}`} autoFocus /></label>
        <div className="rt-row2">
          <label className="rt-field"><span>Medio de pago</span>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} data-testid={`rt-saldo-metodo-${reserva.id}`}>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select></label>
          <label className="rt-field"><span>Fecha del cobro</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} data-testid={`rt-saldo-fecha-${reserva.id}`} /></label>
        </div>
        <label className="rt-field"><span>Comprobante (imagen o PDF, opcional)</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid={`rt-saldo-file-${reserva.id}`} /></label>
        {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}
        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={guardar} disabled={saving} data-testid={`rt-saldo-save-${reserva.id}`}>{saving ? 'Guardando…' : 'Registrar cobro'}</Button>
        </div>
      </div>
    </div>
  );
};

export default CobrarSaldo;
