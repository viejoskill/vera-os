import { useEffect, useRef, useState } from 'react';
import { Calculator, Download, ArrowLeft, Plus, Trash2, Users, CheckCircle2, Paperclip, AlertTriangle } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, fmtDate, hoyAR, TIPO_MOV, METODO_PAGO, type RentalProperty, type Reservation, type LiquidacionReserva, type LiquidacionPendiente } from './api';
import { downloadWithAuth } from '@app/lib/downloadWithAuth';
import { useAuth } from '@app/auth/AuthProvider';
import './rentals.css';

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pagado: { label: 'Liquidada', cls: 'rt-b--ok' },
  parcial: { label: 'Parcial', cls: 'rt-b--warn' },
  pendiente: { label: 'Sin liquidar', cls: 'rt-b--muted' },
};

export const LiquidacionesScreen = () => {
  const { can } = useAuth();
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [pid, setPid] = useState('');
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [sel, setSel] = useState<string | null>(null);
  const [liq, setLiq] = useState<LiquidacionReserva | null>(null);
  const [nm, setNm] = useState({ fecha: hoyAR(), tipo: 'gasto_prop', monto: '', descripcion: '' });
  const [pagoForm, setPagoForm] = useState({ fecha: hoyAR(), metodo: 'transferencia', monto: '', notas: '' });
  const [pagoFile, setPagoFile] = useState<File | null>(null);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [pendientes, setPendientes] = useState<LiquidacionPendiente[]>([]);
  const [err, setErr] = useState('');
  const skipPidReset = useRef(false);

  useEffect(() => { api.listProperties().then((p) => { setProps(p); if (p[0]) setPid(p[0].id); }).catch(() => setProps([])); }, []);
  useEffect(() => { api.liquidacionesPendientes(7).then(setPendientes).catch(() => setPendientes([])); }, []);
  useEffect(() => {
    if (!pid) return;
    if (skipPidReset.current) { skipPidReset.current = false; } else { setSel(null); setLiq(null); }
    api.liquidables(pid).then(setReservas).catch(() => setReservas([]));
  }, [pid]);
  useEffect(() => {
    if (liq) {
      setPagoForm({ fecha: hoyAR(), metodo: 'transferencia', monto: String(liq.saldoLiquidacion || ''), notas: '' });
      setPagoFile(null);
    }
  }, [liq?.reserva.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (rid: string) => {
    setSel(rid); setErr('');
    try { setLiq(await api.liquidacionReserva(rid)); } catch (e) { setErr((e as Error).message); }
  };
  const abrirDesdeRecordatorio = async (propertyId: string, rid: string) => {
    if (propertyId !== pid) { skipPidReset.current = true; setPid(propertyId); }
    await abrir(rid);
  };
  const recargar = async () => { if (sel) setLiq(await api.liquidacionReserva(sel)); };
  const recargarPendientes = () => { api.liquidacionesPendientes(7).then(setPendientes).catch(() => setPendientes([])); };

  const addMov = async () => {
    if (!sel || !nm.monto) return;
    await api.createMovimiento({ propertyId: pid, reservaId: sel, fecha: nm.fecha || hoyAR(), tipo: nm.tipo, monto: Number(nm.monto), descripcion: nm.descripcion });
    setNm({ fecha: hoyAR(), tipo: 'gasto_prop', monto: '', descripcion: '' });
    await recargar();
  };
  const delMov = async (mid: string) => { await api.deleteMovimiento(mid); await recargar(); };

  const agregarPago = async () => {
    if (!sel || !pagoForm.monto || Number(pagoForm.monto) <= 0) { setErr('Ingresá un monto válido para registrar el pago.'); return; }
    setGuardandoPago(true); setErr('');
    try {
      await api.registrarPagoPropietario(sel, Number(pagoForm.monto), pagoForm.metodo, pagoForm.fecha || hoyAR(), pagoForm.notas, pagoFile);
      const fresh = await api.liquidacionReserva(sel);
      setLiq(fresh);
      setPagoForm({ fecha: hoyAR(), metodo: 'transferencia', monto: String(fresh.saldoLiquidacion || ''), notas: '' });
      setPagoFile(null);
      const r = await api.liquidables(pid); setReservas(r);
      recargarPendientes();
    } catch (e) { setErr((e as Error).message); }
    setGuardandoPago(false);
  };
  const borrarPago = async (pagoId: string) => {
    if (!sel) return;
    setErr('');
    try {
      await api.borrarPagoPropietario(sel, pagoId);
      await recargar();
      const r = await api.liquidables(pid); setReservas(r);
      recargarPendientes();
    } catch (e) { setErr((e as Error).message); }
  };

  const mon = liq?.propiedad.moneda || 'ARS';
  const propMoneda = props.find((p) => p.id === pid)?.moneda || 'ARS';
  const reservasFiltradas = reservas.filter((r) => (tab === 'historial' ? r.estadoLiquidacion === 'pagado' : r.estadoLiquidacion !== 'pagado'));
  const totalHistorial = reservasFiltradas.reduce((acc, r) => acc + (r.totalPagadoPropietario || 0), 0);

  return (
    <div className="vera-screen rt" data-testid="liquidaciones-screen">
      <header className="rt__head">
        <div>
          <h2 className="rt__title"><Calculator size={20} /> Liquidaciones al propietario</h2>
          <p className="rt__sub">Elegí una propiedad y una reserva efectuada (con seña pagada). Podés ajustar gastos y comisión antes de liquidar. Neto = alquiler − comisión − gastos del propietario.</p>
        </div>
      </header>

      {pendientes.length > 0 && (
        <div className="rt-liq__recordatorio" data-testid="rt-liq-recordatorio">
          <AlertTriangle size={17} />
          <div className="rt-liq__recordatorio-body">
            <strong>{pendientes.length} reserva{pendientes.length === 1 ? '' : 's'} con la seña cobrada hace más de una semana, sin liquidar o con saldo pendiente</strong>
            <ul className="rt-liq__recordatorio-list">
              {pendientes.slice(0, 6).map((p) => (
                <li key={p.reservaId}>
                  <button
                    type="button"
                    onClick={() => abrirDesdeRecordatorio(p.propertyId, p.reservaId)}
                    data-testid={`rt-liq-recordatorio-item-${p.reservaId}`}
                  >
                    {p.propertyCodigo ? `${p.propertyCodigo} · ` : ''}{p.huesped || 'Huésped'} · {p.diasSinLiquidar} días
                    {p.estadoLiquidacion === 'parcial' && p.saldoLiquidacion ? ` · falta ${fmtMoney(p.saldoLiquidacion, 'ARS')}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rt-liq__filters" data-testid="rt-liq-filters">
        <select value={pid} onChange={(e) => setPid(e.target.value)} data-testid="rt-liq-prop">
          {props.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.titulo}</option>)}
        </select>
      </div>
      {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}

      {!liq && (
        <>
          <div className="rt__tabs" data-testid="rt-liq-tabs">
            <button type="button" className={tab === 'pendientes' ? 'sel' : ''} onClick={() => setTab('pendientes')} data-testid="rt-liq-tab-pendientes">Pendientes</button>
            <button type="button" className={tab === 'historial' ? 'sel' : ''} onClick={() => setTab('historial')} data-testid="rt-liq-tab-historial">Historial</button>
          </div>
          {tab === 'historial' && reservasFiltradas.length > 0 && (
            <p className="rt-hint" data-testid="rt-liq-historial-total">
              Total liquidado: <strong>{fmtMoney(totalHistorial, propMoneda)}</strong> en {reservasFiltradas.length} reserva{reservasFiltradas.length === 1 ? '' : 's'}.
            </p>
          )}
          <div className="rt-liq__list" data-testid="rt-liq-reservas">
            {reservasFiltradas.length === 0 && (
              <p className="rt__empty">
                {tab === 'historial'
                  ? 'Todavía no liquidaste ninguna reserva de esta propiedad.'
                  : 'No hay reservas pendientes de liquidar en esta propiedad.'}
              </p>
            )}
            {reservasFiltradas.map((r) => {
              const badge = ESTADO_BADGE[r.estadoLiquidacion || 'pendiente'];
              return (
                <button type="button" className="rt-liq__resitem" key={r.id} onClick={() => abrir(r.id)} data-testid={`rt-liq-res-${r.id}`}>
                  <div className="rt-liq__resmain">
                    <strong>{r.huesped.nombre}</strong>
                    <span><Users size={13} /> {r.huesped.huespedes || 1} · {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)} · {r.noches} noches</span>
                  </div>
                  <div className="rt-liq__resmeta">
                    <span className="rt-b rt-b--ok"><CheckCircle2 size={13} /> Seña {fmtMoney(r.pago?.monto || 0, 'ARS')}</span>
                    <span className={`rt-b ${badge.cls}`} data-testid={`rt-liq-badge-${r.estadoLiquidacion}-${r.id}`}>
                      {r.estadoLiquidacion === 'pagado' && <CheckCircle2 size={13} />}
                      {badge.label}{r.estadoLiquidacion === 'parcial' ? ` · pagado ${fmtMoney(r.totalPagadoPropietario || 0, r.moneda)}` : ''}
                    </span>
                    <strong>{fmtMoney(r.montoEstimado, r.moneda)}</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </>
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
            <Button variant="secondary" size="sm" onClick={() => downloadWithAuth(api.liquidacionReservaPdfUrl(liq.reserva.id), `liquidacion-${liq.reserva.id}.pdf`).catch((e) => window.alert((e as Error).message))} data-testid="rt-liq-pdf"><Download size={15} /> Descargar PDF</Button>
          </div>

          <div className="rt-liq__grid">
            <div className="rt-liq__cell"><span>Alquiler {liq.ingresos !== liq.alquiler ? '+ extras' : ''}</span><strong>{fmtMoney(liq.ingresos, mon)}</strong></div>
            <div className="rt-liq__cell"><span>− Comisión</span><strong>-{fmtMoney(liq.comision, mon)}</strong></div>
            <div className="rt-liq__cell"><span>− Gastos del propietario</span><strong>-{fmtMoney(liq.gastosPropietario, mon)}</strong></div>
            <div className="rt-liq__cell rt-liq__cell--net"><span>Neto a liquidar</span><strong data-testid="rt-liq-neto">{fmtMoney(liq.netoPropietario, mon)}</strong></div>
          </div>
          <p className="rt-hint">Gastos a cargo de la agencia: {fmtMoney(liq.gastosNuestros, mon)} (no se descuentan al propietario).</p>

          <h4 className="rt-ws__sec">Pago al propietario</h4>
          {liq.estadoLiquidacion === 'pagado' ? (
            <p className="rt-liq__pagook-mini" data-testid="rt-liq-pago-completa">
              <CheckCircle2 size={15} /> Liquidación completa · {fmtMoney(liq.totalPagadoPropietario, mon)} pagados en {liq.pagosPropietario.length} pago{liq.pagosPropietario.length === 1 ? '' : 's'}.
            </p>
          ) : (
            <p className="rt-liq__pagopend" data-testid="rt-liq-pago-pendiente">
              {liq.totalPagadoPropietario > 0
                ? <>Pagado <strong>{fmtMoney(liq.totalPagadoPropietario, mon)}</strong> de {fmtMoney(liq.netoPropietario, mon)} · falta <strong>{fmtMoney(liq.saldoLiquidacion, mon)}</strong>.</>
                : <>Todavía no se registró ningún pago al propietario.</>}
            </p>
          )}
          {liq.pagosPropietario.length > 0 && (
            <div className="rt-saldo__list" data-testid="rt-liq-pagos-lista">
              {liq.pagosPropietario.map((p) => (
                <span key={p.id} className="rt-saldo__chip" data-testid={`rt-liq-pago-item-${p.id}`}>
                  {fmtMoney(p.monto, mon)} · {METODO_PAGO[p.metodo] || p.metodo}{p.fecha ? ` · ${fmtDate(p.fecha)}` : ''}{p.notas ? ` · ${p.notas}` : ''}
                  {p.comprobanteId && (
                    <a className="rt-saldo__ic" href={api.comprobanteItemUrl(liq.reserva.id, p.comprobanteId)} target="_blank" rel="noreferrer" title="Ver comprobante" data-testid={`rt-liq-pago-comp-${p.id}`}><Paperclip size={12} /></a>
                  )}
                  {can('liquidaciones', 'borrar') && (
                    <button type="button" className="rt-saldo__del" onClick={() => borrarPago(p.id)} title="Quitar" data-testid={`rt-liq-pago-del-${p.id}`}><Trash2 size={11} /></button>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="rt-liq__pagoform" data-testid="rt-liq-pago-form">
            <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} data-testid="rt-liqpago-fecha" />
            <select value={pagoForm.metodo} onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })} data-testid="rt-liqpago-metodo">
              {Object.entries(METODO_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" placeholder="Monto pagado" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} data-testid="rt-liqpago-monto" />
            <input type="text" placeholder="Notas (opcional)" value={pagoForm.notas} onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })} data-testid="rt-liqpago-notas" />
            <label className="rt-mini rt-mini--file">
              <Paperclip size={13} /> {pagoFile ? pagoFile.name.slice(0, 18) : 'Comprobante'}
              <input type="file" accept="image/*,.pdf" onChange={(e) => setPagoFile(e.target.files?.[0] || null)} data-testid="rt-liqpago-file" />
            </label>
            <button type="button" className="rt-mini rt-mini--ok" onClick={agregarPago} disabled={guardandoPago} data-testid="rt-liqpago-save">
              <Plus size={14} /> {guardandoPago ? 'Guardando…' : 'Agregar pago'}
            </button>
          </div>

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
                {can('liquidaciones', 'borrar') && (
                  <button type="button" className="rt-mov__del" onClick={() => delMov(m.id)} data-testid={`rt-liqdelmov-${m.id}`}><Trash2 size={14} /></button>
                )}
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
