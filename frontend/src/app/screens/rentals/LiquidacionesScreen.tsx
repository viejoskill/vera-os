import { useEffect, useState } from 'react';
import { Calculator, Download, ArrowLeft, Plus, Trash2, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, fmtDate, TIPO_MOV, type RentalProperty, type Reservation, type LiquidacionReserva } from './api';
import './rentals.css';

const HOY = new Date().toISOString().slice(0, 10);

export const LiquidacionesScreen = () => {
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [pid, setPid] = useState('');
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [liq, setLiq] = useState<LiquidacionReserva | null>(null);
  const [nm, setNm] = useState({ fecha: HOY, tipo: 'gasto_prop', monto: '', descripcion: '' });
  const [err, setErr] = useState('');

  useEffect(() => { api.listProperties().then((p) => { setProps(p); if (p[0]) setPid(p[0].id); }); }, []);
  useEffect(() => { if (pid) { setSel(null); setLiq(null); api.liquidables(pid).then(setReservas).catch(() => setReservas([])); } }, [pid]);

  const abrir = async (rid: string) => {
    setSel(rid); setErr('');
    try { setLiq(await api.liquidacionReserva(rid)); } catch (e) { setErr((e as Error).message); }
  };
  const recargar = async () => { if (sel) setLiq(await api.liquidacionReserva(sel)); };

  const addMov = async () => {
    if (!sel || !nm.monto) return;
    await api.createMovimiento({ propertyId: pid, reservaId: sel, fecha: nm.fecha || HOY, tipo: nm.tipo, monto: Number(nm.monto), descripcion: nm.descripcion });
    setNm({ fecha: HOY, tipo: 'gasto_prop', monto: '', descripcion: '' });
    await recargar();
  };
  const delMov = async (mid: string) => { await api.deleteMovimiento(mid); await recargar(); };

  const mon = liq?.propiedad.moneda || 'ARS';

  return (
    <div className="vera-screen rt" data-testid="liquidaciones-screen">
      <header className="rt__head">
        <div>
          <h2 className="rt__title"><Calculator size={20} /> Liquidaciones al propietario</h2>
          <p className="rt__sub">Elegí una propiedad y una reserva efectuada (con seña pagada). Podés ajustar gastos y comisión antes de liquidar. Neto = alquiler − comisión − gastos del propietario.</p>
        </div>
      </header>

      <div className="rt-liq__filters" data-testid="rt-liq-filters">
        <select value={pid} onChange={(e) => setPid(e.target.value)} data-testid="rt-liq-prop">
          {props.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.titulo}</option>)}
        </select>
      </div>
      {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}

      {!liq && (
        <div className="rt-liq__list" data-testid="rt-liq-reservas">
          {reservas.length === 0 && <p className="rt__empty">Todavía no hay reservas efectuadas (con seña pagada) en esta propiedad.</p>}
          {reservas.map((r) => (
            <button type="button" className="rt-liq__resitem" key={r.id} onClick={() => abrir(r.id)} data-testid={`rt-liq-res-${r.id}`}>
              <div className="rt-liq__resmain">
                <strong>{r.huesped.nombre}</strong>
                <span><Users size={13} /> {r.huesped.huespedes || 1} · {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)} · {r.noches} noches</span>
              </div>
              <div className="rt-liq__resmeta">
                <span className="rt-b rt-b--ok"><CheckCircle2 size={13} /> Seña {fmtMoney(r.pago?.monto || 0, 'ARS')}</span>
                <strong>{fmtMoney(r.montoEstimado, r.moneda)}</strong>
              </div>
            </button>
          ))}
        </div>
      )}

      {liq && (
        <div className="rt-liq" data-testid="rt-liq-result">
          <button type="button" className="rt-mini" onClick={() => { setLiq(null); setSel(null); }} data-testid="rt-liq-back"><ArrowLeft size={14} /> Volver a las reservas</button>
          <div className="rt-liq__head">
            <div>
              <h3>{liq.propiedad.codigo} · {liq.propiedad.titulo}</h3>
              <p>Propietario: <strong>{liq.propietario.nombre || '—'}</strong>{liq.propietario.telefono ? ` · ${liq.propietario.telefono}` : ''}</p>
              <p>Huésped: <strong>{liq.huesped.nombre || '—'}</strong></p>
              <p className="rt-hint">Estadía {fmtDate(liq.periodo.desde)} → {fmtDate(liq.periodo.hasta)} · {liq.reserva.noches} noches</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.open(api.liquidacionReservaPdfUrl(liq.reserva.id), '_blank')} data-testid="rt-liq-pdf"><Download size={15} /> Descargar PDF</Button>
          </div>

          <div className="rt-liq__grid">
            <div className="rt-liq__cell"><span>Alquiler {liq.ingresos !== liq.alquiler ? '+ extras' : ''}</span><strong>{fmtMoney(liq.ingresos, mon)}</strong></div>
            <div className="rt-liq__cell"><span>− Comisión</span><strong>-{fmtMoney(liq.comision, mon)}</strong></div>
            <div className="rt-liq__cell"><span>− Gastos del propietario</span><strong>-{fmtMoney(liq.gastosPropietario, mon)}</strong></div>
            <div className="rt-liq__cell rt-liq__cell--net"><span>Neto a liquidar</span><strong data-testid="rt-liq-neto">{fmtMoney(liq.netoPropietario, mon)}</strong></div>
          </div>
          <p className="rt-hint">Gastos a cargo de la agencia: {fmtMoney(liq.gastosNuestros, mon)} (no se descuentan al propietario).</p>

          <h4 className="rt-ws__sec">Ajustar movimientos de esta reserva</h4>
          <div className="rt-mov__add" data-testid="rt-liq-movadd">
            <input type="date" value={nm.fecha} onChange={(e) => setNm({ ...nm, fecha: e.target.value })} data-testid="rt-liqmov-fecha" />
            <select value={nm.tipo} onChange={(e) => setNm({ ...nm, tipo: e.target.value })} data-testid="rt-liqmov-tipo">
              {Object.entries(TIPO_MOV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" placeholder="Monto" value={nm.monto} onChange={(e) => setNm({ ...nm, monto: e.target.value })} data-testid="rt-liqmov-monto" />
            <input type="text" placeholder="Descripción" value={nm.descripcion} onChange={(e) => setNm({ ...nm, descripcion: e.target.value })} data-testid="rt-liqmov-desc" />
            <button type="button" className="rt-mini rt-mini--ok" onClick={addMov} data-testid="rt-liqmov-save"><Plus size={14} /> Agregar</button>
          </div>
          <div className="rt-mov">
            {liq.movimientos.map((m) => (
              <div className={`rt-mov__row rt-mov__row--${m.tipo}`} key={m.id} data-testid={`rt-liqmov-${m.id}`}>
                <span className="rt-mov__fecha">{fmtDate(m.fecha)}</span>
                <span className="rt-mov__tipo">{TIPO_MOV[m.tipo] || m.tipo}</span>
                <span className="rt-mov__desc">{m.descripcion}</span>
                <span className="rt-mov__monto">{fmtMoney(m.monto, mon)}</span>
                <button type="button" className="rt-mov__del" onClick={() => delMov(m.id)} data-testid={`rt-liqdelmov-${m.id}`}><Trash2 size={14} /></button>
              </div>
            ))}
            {liq.movimientos.length === 0 && <p className="rt-hint">Sin movimientos cargados. La comisión se genera automática al confirmar; agregá gastos si hace falta.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidacionesScreen;
