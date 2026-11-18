import { useEffect, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, fmtDate, type PagoLegadoItem } from './api';

/** Pagos al propietario cargados ANTES de que la app calculara sola bruto/comisión:
 * quedaron con monto = neto, sin comisión registrada, aunque muchos sí la tenían
 * descontada a mano por quien cargó el pago. Esta herramienta los lista para revisar
 * uno por uno (con la corrección que resultaría) y aplicar solo los que correspondan. */
export const PagosLegadoPanel = ({ onApplied, refreshKey }: { onApplied: () => void; refreshKey?: number }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PagoLegadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgIsError, setMsgIsError] = useState(false);

  const cargar = () => {
    setLoading(true);
    api.pagosLegado().then((r) => { setItems(r); setSel(new Set()); }).catch(() => setItems([])).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) => {
    const next = new Set(sel);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSel(next);
  };

  const aplicar = async () => {
    const elegidos = items.filter((i) => sel.has(`${i.reservaId}:${i.pagoId}`)).map((i) => ({ reservaId: i.reservaId, pagoId: i.pagoId }));
    if (elegidos.length === 0) return;
    if (!window.confirm(`¿Aplicar la corrección de comisión a ${elegidos.length} pago(s) seleccionado(s)? Esta acción queda registrada en el historial.`)) return;
    setApplying(true); setMsg(''); setMsgIsError(false);
    try {
      const r = await api.aplicarPagosLegado(elegidos);
      setMsg(`Se corrigieron ${r.aplicados.length} pago(s).${r.avisos.length ? ' ' + r.avisos.join(' ') : ''}`);
      cargar();
      onApplied();
    } catch (e) { setMsg((e as Error).message); setMsgIsError(true); }
    setApplying(false);
  };

  if (!open) {
    return (
      <button type="button" className="rt-liq__legadobtn" onClick={() => setOpen(true)} data-testid="rt-liq-legado-toggle">
        <ArrowDownUp size={13} /> Revisar pagos anteriores{items.length > 0 ? ` (${items.length})` : ''}
      </button>
    );
  }

  return (
    <div className="rt-liq__legado" data-testid="rt-liq-legado-panel">
      <div className="rt-liq__legadohead">
        <h4 className="rt-ws__sec" style={{ margin: 0 }}>Revisar pagos anteriores</h4>
        <button type="button" className="rt-mini" onClick={() => setOpen(false)} data-testid="rt-liq-legado-close">Cerrar</button>
      </div>
      <p className="rt-hint">Pagos al propietario cargados antes de que la app calculara sola la comisión. Tildá los que ya tenían la comisión descontada y aplicá la corrección — los demás quedan sin tocar.</p>
      {loading && <p className="rt-hint">Cargando…</p>}
      {!loading && items.length === 0 && <p className="rt-hint">No hay pagos pendientes de revisión.</p>}
      {msg && <p className={msgIsError ? 'rt-liq__pagowarn' : 'rt-liq__pagook-mini'} data-testid="rt-liq-legado-msg">{msg}</p>}
      {items.map((i) => {
        const key = `${i.reservaId}:${i.pagoId}`;
        return (
          <label key={key} className="rt-liq__legadorow" data-testid={`rt-liq-legado-row-${i.pagoId}`}>
            <input type="checkbox" checked={sel.has(key)} onChange={() => toggle(key)} data-testid={`rt-liq-legado-check-${i.pagoId}`} />
            <span className="rt-liq__legadoinfo">
              <strong>{i.propiedad.codigo} {i.propiedad.titulo}</strong> · {i.propietario || 'sin propietario'} · {i.huesped || 'sin huésped'}
              <br />
              {i.fecha ? fmtDate(i.fecha) : ''} · pagado {fmtMoney(i.monto)} neto → si tenía comisión descontada: bruto {fmtMoney(i.montoBrutoEstimado)} · comisión {Number(i.comisionPctEfectivo.toFixed(2))}% ({fmtMoney(i.comisionEstimada)})
              {i.limitado && ' · se limitará al saldo de comisión pendiente de esa reserva'}
            </span>
          </label>
        );
      })}
      {items.length > 0 && (
        <Button size="sm" variant="primary" onClick={aplicar} disabled={applying || sel.size === 0} data-testid="rt-liq-legado-aplicar">
          {applying ? 'Aplicando…' : `Aplicar a seleccionados (${sel.size})`}
        </Button>
      )}
    </div>
  );
};
