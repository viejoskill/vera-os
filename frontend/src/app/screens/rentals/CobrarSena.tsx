import { useState } from 'react';
import { CreditCard, Copy, Check, ExternalLink, RefreshCw, X, FileDown } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, type Reservation } from './api';

export const CobrarSena = ({ reserva, onUpdated }: { reserva: Reservation; onUpdated?: () => void }) => {
  const pago = reserva.pago;
  const esUSD = reserva.moneda === 'USD';
  const sugerido = esUSD ? 0 : Math.round((reserva.montoEstimado || 0) * 0.3);
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState(String(sugerido || ''));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const generar = async () => {
    const n = Number(monto);
    if (!n || n <= 0) { setErr('Ingresá un monto en pesos (ARS) mayor a cero.'); return; }
    setErr(''); setLoading(true);
    try {
      const r = await api.paymentLink(reserva.id, n);
      await navigator.clipboard.writeText(r.initPoint).catch(() => {});
      setOpen(false); onUpdated?.();
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  };

  const copyLink = async () => {
    if (!pago?.initPoint) return;
    try { await navigator.clipboard.writeText(pago.initPoint); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.open(pago.initPoint, '_blank'); }
  };

  if (pago?.estado === 'pagado') {
    return (
      <span className="rt-pay rt-pay--ok" data-testid={`rt-pay-ok-${reserva.id}`}>
        <Check size={13} /> Seña pagada · {fmtMoney(pago.monto || 0, 'ARS')}
        <a className="rt-pay__ic" href={api.reciboSenaUrl(reserva.id)} target="_blank" rel="noreferrer" title="Descargar recibo de seña" data-testid={`rt-recibo-${reserva.id}`}><FileDown size={13} /></a>
      </span>
    );
  }

  if (pago?.initPoint && (pago.estado === 'pendiente' || pago.estado === 'rechazado')) {
    return (
      <span className="rt-pay rt-pay--pend" data-testid={`rt-pay-pend-${reserva.id}`}>
        <CreditCard size={13} /> Seña {fmtMoney(pago.monto || 0, 'ARS')} · {pago.estado === 'rechazado' ? 'rechazada' : 'link enviado'}
        <button type="button" className="rt-pay__ic" onClick={copyLink} title="Copiar link" data-testid={`rt-pay-copy-${reserva.id}`}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
        <a className="rt-pay__ic" href={pago.initPoint} target="_blank" rel="noreferrer" title="Abrir" data-testid={`rt-pay-open-${reserva.id}`}><ExternalLink size={13} /></a>
        <button type="button" className="rt-pay__ic" onClick={() => { setMonto(String(pago.monto || sugerido || '')); setOpen(true); }} title="Regenerar" data-testid={`rt-pay-regen-${reserva.id}`}><RefreshCw size={13} /></button>
        {open && <Modal {...{ monto, setMonto, err, loading, generar, esUSD, onClose: () => setOpen(false), rid: reserva.id }} />}
      </span>
    );
  }

  return (
    <>
      <button type="button" className="rt-mini rt-mini--pay" onClick={() => setOpen(true)} data-testid={`rt-pay-btn-${reserva.id}`}><CreditCard size={14} /> Cobrar seña</button>
      {open && <Modal {...{ monto, setMonto, err, loading, generar, esUSD, onClose: () => setOpen(false), rid: reserva.id }} />}
    </>
  );
};

const Modal = ({ monto, setMonto, err, loading, generar, esUSD, onClose, rid }: {
  monto: string; setMonto: (v: string) => void; err: string; loading: boolean;
  generar: () => void; esUSD: boolean; onClose: () => void; rid: string;
}) => (
  <div className="rt-modal" data-testid={`rt-pay-modal-${rid}`} onClick={onClose}>
    <div className="rt-modal__box rt-modal__box--sm" onClick={(e) => e.stopPropagation()}>
      <div className="rt-modal__head">
        <h3><CreditCard size={18} /> Cobrar seña con Mercado Pago</h3>
        <button type="button" onClick={onClose} data-testid={`rt-pay-close-${rid}`}><X size={18} /></button>
      </div>
      <p className="rt-modal__sub">Se genera un link de pago en <strong>pesos (ARS)</strong>. Al confirmarse el pago, la reserva queda marcada como <strong>Seña pagada</strong>.{esUSD && ' Esta reserva está en USD: ingresá el monto equivalente en pesos.'}</p>
      <label className="rt-field"><span>Monto de la seña (ARS)</span>
        <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej.: 94500" data-testid={`rt-pay-monto-${rid}`} autoFocus /></label>
      {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}
      <div className="rt-modal__foot">
        <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="md" onClick={generar} disabled={loading} data-testid={`rt-pay-generate-${rid}`}>{loading ? 'Generando…' : 'Generar link y copiar'}</Button>
      </div>
    </div>
  </div>
);

export default CobrarSena;
