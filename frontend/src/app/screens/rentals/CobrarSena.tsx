import { useState } from 'react';
import { CreditCard, Copy, Check, ExternalLink, RefreshCw, X, FileDown, RefreshCcw, BadgeCheck, Paperclip } from 'lucide-react';
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
  const [verifying, setVerifying] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

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

  const verificar = async () => {
    setVerifying(true);
    try { await api.verificarPago(reserva.id); onUpdated?.(); } finally { setVerifying(false); }
  };

  const copyLink = async () => {
    if (!pago?.initPoint) return;
    try { await navigator.clipboard.writeText(pago.initPoint); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.open(pago.initPoint, '_blank'); }
  };

  if (pago?.estado === 'pagado') {
    return (
      <span className="rt-pay rt-pay--ok" data-testid={`rt-pay-ok-${reserva.id}`}>
        <Check size={13} /> Seña pagada · {fmtMoney(pago.monto || 0, 'ARS')}{pago.metodo && pago.metodo !== 'mercadopago' ? ` (${pago.metodo})` : ''}
        {pago.comprobante && <a className="rt-pay__ic" href={api.comprobanteUrl(reserva.id)} target="_blank" rel="noreferrer" title="Ver comprobante" data-testid={`rt-comprobante-${reserva.id}`}><Paperclip size={13} /></a>}
        <a className="rt-pay__ic" href={api.reciboSenaUrl(reserva.id)} target="_blank" rel="noreferrer" title="Descargar recibo de seña" data-testid={`rt-recibo-${reserva.id}`}><FileDown size={13} /></a>
      </span>
    );
  }

  const marcarBtn = (
    <button type="button" className="rt-mini rt-mini--ok" onClick={() => setPayOpen(true)} data-testid={`rt-marcar-btn-${reserva.id}`}><BadgeCheck size={14} /> Marcar pagada</button>
  );

  if (pago?.initPoint && (pago.estado === 'pendiente' || pago.estado === 'rechazado')) {
    return (
      <>
        <span className="rt-pay rt-pay--pend" data-testid={`rt-pay-pend-${reserva.id}`}>
          <CreditCard size={13} /> Seña {fmtMoney(pago.monto || 0, 'ARS')} · {pago.estado === 'rechazado' ? 'rechazada' : 'link enviado'}
          <button type="button" className="rt-pay__ic" onClick={copyLink} title="Copiar link" data-testid={`rt-pay-copy-${reserva.id}`}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
          <a className="rt-pay__ic" href={pago.initPoint} target="_blank" rel="noreferrer" title="Abrir" data-testid={`rt-pay-open-${reserva.id}`}><ExternalLink size={13} /></a>
          <button type="button" className="rt-pay__ic" onClick={() => { setMonto(String(pago.monto || sugerido || '')); setOpen(true); }} title="Regenerar" data-testid={`rt-pay-regen-${reserva.id}`}><RefreshCw size={13} /></button>
        </span>
        <button type="button" className="rt-mini" onClick={verificar} disabled={verifying} data-testid={`rt-verificar-${reserva.id}`}><RefreshCcw size={14} /> {verifying ? 'Verificando…' : 'Verificar pago'}</button>
        {marcarBtn}
        {open && <Modal {...{ monto, setMonto, err, loading, generar, esUSD, onClose: () => setOpen(false), rid: reserva.id }} />}
        {payOpen && <MarcarModal reserva={reserva} sugerido={pago.monto || sugerido} onClose={() => setPayOpen(false)} onDone={() => { setPayOpen(false); onUpdated?.(); }} />}
      </>
    );
  }

  return (
    <>
      <button type="button" className="rt-mini rt-mini--pay" onClick={() => setOpen(true)} data-testid={`rt-pay-btn-${reserva.id}`}><CreditCard size={14} /> Cobrar seña</button>
      {marcarBtn}
      {open && <Modal {...{ monto, setMonto, err, loading, generar, esUSD, onClose: () => setOpen(false), rid: reserva.id }} />}
      {payOpen && <MarcarModal reserva={reserva} sugerido={sugerido} onClose={() => setPayOpen(false)} onDone={() => { setPayOpen(false); onUpdated?.(); }} />}
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

const MarcarModal = ({ reserva, sugerido, onClose, onDone }: {
  reserva: Reservation; sugerido: number; onClose: () => void; onDone: () => void;
}) => {
  const [monto, setMonto] = useState(String(sugerido || ''));
  const [metodo, setMetodo] = useState('transferencia');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const guardar = async () => {
    const n = Number(monto);
    if (!n || n <= 0) { setErr('Ingresá el monto de la seña cobrada.'); return; }
    setErr(''); setSaving(true);
    try { await api.marcarPagada(reserva.id, n, metodo, file); onDone(); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  };
  return (
    <div className="rt-modal" data-testid={`rt-marcar-modal-${reserva.id}`} onClick={onClose}>
      <div className="rt-modal__box rt-modal__box--sm" onClick={(e) => e.stopPropagation()}>
        <div className="rt-modal__head">
          <h3><BadgeCheck size={18} /> Marcar seña como pagada</h3>
          <button type="button" onClick={onClose} data-testid={`rt-marcar-close-${reserva.id}`}><X size={18} /></button>
        </div>
        <p className="rt-modal__sub">Registrá una seña cobrada por fuera de Mercado Pago (transferencia, efectivo, etc.). Podés adjuntar el comprobante.</p>
        <label className="rt-field"><span>Monto cobrado (ARS)</span>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} data-testid={`rt-marcar-monto-${reserva.id}`} autoFocus /></label>
        <label className="rt-field"><span>Medio de pago</span>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} data-testid={`rt-marcar-metodo-${reserva.id}`}>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="otro">Otro</option>
          </select></label>
        <label className="rt-field"><span>Comprobante (imagen o PDF, opcional)</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid={`rt-marcar-file-${reserva.id}`} /></label>
        {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}
        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={guardar} disabled={saving} data-testid={`rt-marcar-save-${reserva.id}`}>{saving ? 'Guardando…' : 'Confirmar pago'}</Button>
        </div>
      </div>
    </div>
  );
};

export default CobrarSena;
