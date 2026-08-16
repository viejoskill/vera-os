import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PiggyBank, Plus, Trash2, TrendingUp, TrendingDown, Scale, BarChart3, ListFilter,
  ArrowUpRight, ArrowDownRight, Repeat, Power,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Button } from '@vera/ui';
import { env } from '@vera/config';
import './contabilidad.css';

const API = `${env.backendUrl}/api/contabilidad`;

interface CurStats {
  ingresos: number; gastos: number; neto: number;
  ingresosPorCat: Record<string, number>; gastosPorCat: Record<string, number>;
}
interface Entry {
  id: string; fecha: string; tipo: 'ingreso' | 'gasto'; categoria: string;
  moneda: string; monto: number; descripcion?: string; origen: string; recurrente?: boolean;
}
interface MesRow { mes: string; label: string; [k: string]: number | string; }
interface Resumen {
  periodo: { desde: string; hasta: string };
  monedas: Record<string, CurStats>;
  mensual: MesRow[];
  movimientos: Entry[];
}
interface Categorias { ingreso: string[]; gasto: string[]; custom: { id: string; nombre: string; tipo: string }[]; }
interface Recurrente {
  id: string; tipo: 'ingreso' | 'gasto'; categoria: string; moneda: string;
  monto: number; descripcion?: string; diaMes: number; desde: string; activo: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = new Date();
const fmtMoney = (n: number, moneda = 'ARS') => {
  const s = Math.round(n || 0).toLocaleString('es-AR');
  return moneda === 'USD' ? `US$ ${s}` : `$ ${s}`;
};
const fmtDate = (s?: string) => {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};

type PresetKey = 'mes' | '3m' | '6m' | 'anio' | 'custom';
const MESES_N: Record<Exclude<PresetKey, 'custom'>, number> = { mes: 1, '3m': 3, '6m': 6, anio: 12 };
const rangoDe = (key: PresetKey): { desde: string; hasta: string } => {
  const y = HOY.getFullYear();
  const m = HOY.getMonth();
  if (key === 'mes') return { desde: isoDate(new Date(y, m, 1)), hasta: isoDate(new Date(y, m + 1, 0)) };
  if (key === '3m') return { desde: isoDate(new Date(y, m - 2, 1)), hasta: isoDate(new Date(y, m + 1, 0)) };
  if (key === '6m') return { desde: isoDate(new Date(y, m - 5, 1)), hasta: isoDate(new Date(y, m + 1, 0)) };
  if (key === 'anio') return { desde: isoDate(new Date(y, 0, 1)), hasta: isoDate(new Date(y, 11, 31)) };
  return { desde: isoDate(new Date(y, m, 1)), hasta: isoDate(new Date(y, m + 1, 0)) };
};
// Período anterior equivalente para comparar.
const prevRango = (preset: PresetKey, r: { desde: string; hasta: string }) => {
  if (preset !== 'custom') {
    const n = MESES_N[preset];
    const [dy, dm] = r.desde.split('-').map(Number);
    const [hy, hm] = r.hasta.split('-').map(Number);
    const d0 = new Date(dy, dm - 1 - n, 1);
    const h0 = new Date(hy, hm - 1 - n + 1, 0);
    return { desde: isoDate(d0), hasta: isoDate(h0) };
  }
  const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const days = Math.round((parse(r.hasta).getTime() - parse(r.desde).getTime()) / 86400000) + 1;
  const h = new Date(parse(r.desde).getTime() - 86400000);
  const d = new Date(h.getTime() - (days - 1) * 86400000);
  return { desde: isoDate(d), hasta: isoDate(h) };
};

const getJson = async (path: string) => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
};

const Delta = ({ actual, anterior }: { actual: number; anterior: number }) => {
  if (anterior === 0) return <span className="cont__delta cont__delta--new">nuevo</span>;
  const pct = Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  if (pct === 0) return <span className="cont__delta">= 0%</span>;
  const up = pct > 0;
  return (
    <span className={`cont__delta ${up ? 'cont__delta--up' : 'cont__delta--down'}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{up ? '+' : ''}{pct}%
    </span>
  );
};

export const ContabilidadScreen = () => {
  const [preset, setPreset] = useState<PresetKey>('anio');
  const [rango, setRango] = useState(rangoDe('anio'));
  const [data, setData] = useState<Resumen | null>(null);
  const [prev, setPrev] = useState<Resumen | null>(null);
  const [comparar, setComparar] = useState(false);
  const [cats, setCats] = useState<Categorias>({ ingreso: [], gasto: [], custom: [] });
  const [recs, setRecs] = useState<Recurrente[]>([]);
  const [showRecs, setShowRecs] = useState(false);
  const [cur, setCur] = useState('ARS');
  const [err, setErr] = useState('');

  const [f, setF] = useState({ tipo: 'gasto' as 'ingreso' | 'gasto', categoria: '', moneda: 'ARS', monto: '', fecha: isoDate(HOY), descripcion: '' });
  const [newCat, setNewCat] = useState<string | null>(null);
  const [fltTipo, setFltTipo] = useState('');
  const [fltCat, setFltCat] = useState('');

  // form recurrente
  const mesActual = `${HOY.getFullYear()}-${pad(HOY.getMonth() + 1)}`;
  const [rf, setRf] = useState({ tipo: 'gasto' as 'ingreso' | 'gasto', categoria: '', moneda: 'ARS', monto: '', diaMes: '1', desde: mesActual, descripcion: '' });

  const loadCats = useCallback(async () => setCats(await getJson('/categorias')), []);
  const loadRecs = useCallback(async () => setRecs(await getJson('/recurrentes')), []);

  const load = useCallback(async () => {
    setErr('');
    try {
      const d: Resumen = await getJson(`/resumen?desde=${rango.desde}&hasta=${rango.hasta}`);
      setData(d);
      const monedas = Object.keys(d.monedas);
      if (monedas.length && !monedas.includes(cur)) setCur(monedas[0]);
      if (comparar) {
        const pr = prevRango(preset, rango);
        setPrev(await getJson(`/resumen?desde=${pr.desde}&hasta=${pr.hasta}`));
      } else {
        setPrev(null);
      }
    } catch (e) { setErr((e as Error).message); }
  }, [rango, cur, comparar, preset]);

  useEffect(() => { loadCats(); loadRecs(); }, [loadCats, loadRecs]);
  useEffect(() => { load(); }, [rango, comparar]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPreset2 = (k: PresetKey) => { setPreset(k); if (k !== 'custom') setRango(rangoDe(k)); };
  const catOptions = f.tipo === 'ingreso' ? cats.ingreso : cats.gasto;
  const rcatOptions = rf.tipo === 'ingreso' ? cats.ingreso : cats.gasto;

  const addEntry = async () => {
    if (!f.categoria || !f.monto) { setErr('Elegí categoría y monto.'); return; }
    setErr('');
    const r = await fetch(`${API}/movimientos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, monto: Number(f.monto) }) });
    if (!r.ok) { setErr('No se pudo guardar el movimiento.'); return; }
    setF({ ...f, monto: '', descripcion: '' });
    await load();
  };
  const delEntry = async (id: string) => { await fetch(`${API}/movimientos/${id}`, { method: 'DELETE' }); await load(); };

  const addCat = async () => {
    const nombre = (newCat || '').trim();
    if (!nombre) { setNewCat(null); return; }
    const r = await fetch(`${API}/categorias`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, tipo: f.tipo }) });
    if (r.ok) { await loadCats(); setF({ ...f, categoria: nombre }); }
    setNewCat(null);
  };

  const addRec = async () => {
    if (!rf.categoria || !rf.monto) { setErr('Elegí categoría y monto para el fijo.'); return; }
    setErr('');
    const r = await fetch(`${API}/recurrentes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rf, monto: Number(rf.monto), diaMes: Number(rf.diaMes) }) });
    if (!r.ok) { setErr('No se pudo guardar el fijo.'); return; }
    setRf({ ...rf, monto: '', descripcion: '' });
    await loadRecs(); await load();
  };
  const toggleRec = async (rc: Recurrente) => {
    await fetch(`${API}/recurrentes/${rc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !rc.activo }) });
    await loadRecs(); await load();
  };
  const delRec = async (id: string) => { await fetch(`${API}/recurrentes/${id}`, { method: 'DELETE' }); await loadRecs(); };

  const stats = data?.monedas[cur];
  const prevStats = prev?.monedas[cur];
  const monedasPresentes = data ? Object.keys(data.monedas) : [];

  const chartData = useMemo(() => (data?.mensual || []).map((m) => ({
    label: m.label, Ingresos: Number(m[`${cur}_ingresos`] || 0), Gastos: Number(m[`${cur}_gastos`] || 0),
  })), [data, cur]);

  const movimientos = useMemo(() => {
    let mv = (data?.movimientos || []).filter((m) => m.moneda === cur);
    if (fltTipo) mv = mv.filter((m) => m.tipo === fltTipo);
    if (fltCat) mv = mv.filter((m) => m.categoria === fltCat);
    return mv;
  }, [data, cur, fltTipo, fltCat]);
  const catsFiltro = useMemo(() => Array.from(new Set((data?.movimientos || []).filter((m) => m.moneda === cur).map((m) => m.categoria))), [data, cur]);

  return (
    <div className="vera-screen cont" data-testid="contabilidad-screen">
      <header className="cont__head">
        <div>
          <h2 className="cont__title"><PiggyBank size={22} /> Contabilidad general</h2>
          <p className="cont__sub">
            Resumen económico de la inmobiliaria. Las comisiones de alquiler se suman
            automáticamente; el resto (comisiones de venta, sueldos, impuestos…) lo cargás vos.
            Todo separado por moneda.
          </p>
        </div>
        <div className="cont__period" data-testid="cont-period">
          <div><label className="cont__breakhead">Desde</label>
            <input type="date" value={rango.desde} data-testid="cont-desde" onChange={(e) => { setPreset('custom'); setRango({ ...rango, desde: e.target.value }); }} /></div>
          <div><label className="cont__breakhead">Hasta</label>
            <input type="date" value={rango.hasta} data-testid="cont-hasta" onChange={(e) => { setPreset('custom'); setRango({ ...rango, hasta: e.target.value }); }} /></div>
        </div>
      </header>

      <div className="cont__toolbar">
        <div className="cont__presets" data-testid="cont-presets">
          {([['mes', 'Este mes'], ['3m', 'Últ. 3 meses'], ['6m', 'Últ. 6 meses'], ['anio', 'Este año']] as [PresetKey, string][]).map(([k, l]) => (
            <button key={k} type="button" className={`cont__preset ${preset === k ? 'on' : ''}`} data-testid={`cont-preset-${k}`} onClick={() => setPreset2(k)}>{l}</button>
          ))}
        </div>
        <label className="cont__switch" data-testid="cont-compare-toggle">
          <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} />
          <Repeat size={14} /> Comparar con período anterior
        </label>
      </div>

      {err && <p className="cont__flash" data-testid="cont-error">{err}</p>}

      {/* Alta de movimiento */}
      <div className="cont__addcard" data-testid="cont-addcard">
        <p className="cont__addtitle"><Plus size={16} /> Cargar ingreso o gasto</p>
        <div className="cont__addrow">
          <select className="vera-select" value={f.tipo} data-testid="cont-f-tipo" onChange={(e) => setF({ ...f, tipo: e.target.value as 'ingreso' | 'gasto', categoria: '' })}>
            <option value="gasto">Gasto</option><option value="ingreso">Ingreso</option>
          </select>
          <select className="vera-select" value={f.categoria} data-testid="cont-f-cat" onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            <option value="">Categoría…</option>{catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="vera-select" value={f.moneda} data-testid="cont-f-moneda" onChange={(e) => setF({ ...f, moneda: e.target.value })}>
            <option value="ARS">ARS</option><option value="USD">USD</option>
          </select>
          <input className="vera-input" type="number" placeholder="Monto" value={f.monto} data-testid="cont-f-monto" onChange={(e) => setF({ ...f, monto: e.target.value })} />
          <input className="vera-input" type="date" value={f.fecha} data-testid="cont-f-fecha" onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          <input className="vera-input" type="text" placeholder="Descripción (opcional)" value={f.descripcion} data-testid="cont-f-desc" onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
          <Button variant="primary" size="md" data-testid="cont-f-add" onClick={addEntry}><Plus size={15} /> Agregar</Button>
        </div>
        <div className="cont__addfoot">
          {newCat === null ? (
            <button type="button" className="cont__catlink" data-testid="cont-newcat-open" onClick={() => setNewCat('')}>+ Nueva categoría de {f.tipo}</button>
          ) : (
            <div className="cont__newcat">
              <input className="vera-input" type="text" autoFocus placeholder={`Nueva categoría de ${f.tipo}`} value={newCat} data-testid="cont-newcat-input"
                onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCat(); if (e.key === 'Escape') setNewCat(null); }} />
              <Button variant="secondary" size="sm" data-testid="cont-newcat-save" onClick={addCat}>Guardar</Button>
              <Button variant="ghost" size="sm" onClick={() => setNewCat(null)}>Cancelar</Button>
            </div>
          )}
          <button type="button" className="cont__catlink" data-testid="cont-recs-toggle" onClick={() => setShowRecs((v) => !v)}>
            <Repeat size={13} /> {showRecs ? 'Ocultar' : 'Gestionar'} fijos mensuales{recs.length ? ` (${recs.length})` : ''}
          </button>
        </div>
      </div>

      {/* Gestión de fijos */}
      {showRecs && (
        <div className="cont__panel" style={{ marginBottom: 26 }} data-testid="cont-recs-panel">
          <h3><Repeat size={16} /> Gastos e ingresos fijos (se cargan solos cada mes)</h3>
          <div className="cont__recadd">
            <select className="vera-select" value={rf.tipo} data-testid="cont-rf-tipo" onChange={(e) => setRf({ ...rf, tipo: e.target.value as 'ingreso' | 'gasto', categoria: '' })}>
              <option value="gasto">Gasto</option><option value="ingreso">Ingreso</option>
            </select>
            <select className="vera-select" value={rf.categoria} data-testid="cont-rf-cat" onChange={(e) => setRf({ ...rf, categoria: e.target.value })}>
              <option value="">Categoría…</option>{rcatOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="vera-select" value={rf.moneda} data-testid="cont-rf-moneda" onChange={(e) => setRf({ ...rf, moneda: e.target.value })}>
              <option value="ARS">ARS</option><option value="USD">USD</option>
            </select>
            <input className="vera-input" type="number" placeholder="Monto" value={rf.monto} data-testid="cont-rf-monto" onChange={(e) => setRf({ ...rf, monto: e.target.value })} />
            <input className="vera-input" type="number" min={1} max={28} placeholder="Día" title="Día del mes" value={rf.diaMes} data-testid="cont-rf-dia" onChange={(e) => setRf({ ...rf, diaMes: e.target.value })} />
            <input className="vera-input" type="month" title="Desde qué mes" value={rf.desde} data-testid="cont-rf-desde" onChange={(e) => setRf({ ...rf, desde: e.target.value })} />
            <input className="vera-input" type="text" placeholder="Descripción" value={rf.descripcion} data-testid="cont-rf-desc" onChange={(e) => setRf({ ...rf, descripcion: e.target.value })} />
            <Button variant="secondary" size="md" data-testid="cont-rf-add" onClick={addRec}><Plus size={15} /> Fijar</Button>
          </div>
          <p className="cont__recshint">Cada fijo genera automáticamente su movimiento cada mes (desde el mes indicado hasta hoy). Si un mes cambia, podés borrarlo o editarlo en la tabla y no se vuelve a crear.</p>
          {recs.length === 0 ? (
            <p className="cont__empty">Todavía no cargaste ningún fijo. Ideal para sueldos, alquiler de oficina, impuestos mensuales…</p>
          ) : (
            <div className="cont__reclist" data-testid="cont-reclist">
              {recs.map((rc) => (
                <div className={`cont__recrow ${rc.activo ? '' : 'cont__recrow--off'}`} key={rc.id} data-testid={`cont-rec-${rc.id}`}>
                  <span className={`cont__pill cont__pill--${rc.tipo === 'ingreso' ? 'in' : 'out'}`}>{rc.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span>
                  <strong>{rc.categoria}</strong>
                  <em>{rc.descripcion || '—'}</em>
                  <span className="cont__recmonto">{fmtMoney(rc.monto, rc.moneda)}</span>
                  <span className="cont__recmeta">día {rc.diaMes} · desde {rc.desde}</span>
                  <button type="button" className={`cont__recpower ${rc.activo ? 'on' : ''}`} title={rc.activo ? 'Pausar' : 'Activar'} data-testid={`cont-rec-toggle-${rc.id}`} onClick={() => toggleRec(rc)}><Power size={14} /></button>
                  <button type="button" className="cont__del" data-testid={`cont-rec-del-${rc.id}`} onClick={() => delRec(rc.id)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!data || monedasPresentes.length === 0 ? (
        <p className="cont__empty" data-testid="cont-empty">Todavía no hay movimientos en este período. Cargá gastos o esperá comisiones de alquiler.</p>
      ) : (
        <>
          <div className="cont__curtabs" data-testid="cont-curtabs">
            {['ARS', 'USD'].filter((m) => monedasPresentes.includes(m)).map((m) => (
              <button key={m} type="button" className={`cont__curtab ${cur === m ? 'on' : ''}`} data-testid={`cont-cur-${m}`} onClick={() => setCur(m)}>
                {m === 'USD' ? 'Dólares (USD)' : 'Pesos (ARS)'}
              </button>
            ))}
          </div>

          {stats && (
            <div className="cont__cards" data-testid="cont-cards">
              <div className="cont__card cont__card--in">
                <span><TrendingUp size={13} /> Ingresos</span>
                <strong data-testid="cont-ingresos">{fmtMoney(stats.ingresos, cur)}</strong>
                {comparar && prevStats && <div className="cont__cmp"><Delta actual={stats.ingresos} anterior={prevStats.ingresos} /><em>antes {fmtMoney(prevStats.ingresos, cur)}</em></div>}
              </div>
              <div className="cont__card cont__card--out">
                <span><TrendingDown size={13} /> Gastos</span>
                <strong data-testid="cont-gastos">{fmtMoney(stats.gastos, cur)}</strong>
                {comparar && prevStats && <div className="cont__cmp"><Delta actual={stats.gastos} anterior={prevStats.gastos} /><em>antes {fmtMoney(prevStats.gastos, cur)}</em></div>}
              </div>
              <div className="cont__card cont__card--net">
                <span><Scale size={13} /> Resultado neto</span>
                <strong className={stats.neto < 0 ? 'neg' : ''} data-testid="cont-neto">{fmtMoney(stats.neto, cur)}</strong>
                {comparar && prevStats && <div className="cont__cmp"><Delta actual={stats.neto} anterior={prevStats.neto} /><em>antes {fmtMoney(prevStats.neto, cur)}</em></div>}
              </div>
            </div>
          )}

          <div className="cont__grid2">
            <div className="cont__panel" data-testid="cont-chart">
              <h3><BarChart3 size={16} /> Comparativo mensual · {cur}</h3>
              <div className="cont__chartwrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip formatter={(value) => fmtMoney(Number(value), cur)}
                      contentStyle={{ background: '#1b1b1e', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#eee' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Ingresos" fill="#4bbf6b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gastos" fill="#e07575" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="cont__panel" data-testid="cont-breakdown">
              <h3><ListFilter size={16} /> Desglose por categoría</h3>
              {stats && Object.keys(stats.ingresosPorCat).length > 0 && (
                <div className="cont__breakcol">
                  <p className="cont__breakhead">Ingresos</p>
                  {Object.entries(stats.ingresosPorCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                    <div className="cont__breakrow cont__breakrow--in" key={c}><em>{c}</em><b>{fmtMoney(v, cur)}</b></div>
                  ))}
                </div>
              )}
              {stats && Object.keys(stats.gastosPorCat).length > 0 && (
                <div className="cont__breakcol">
                  <p className="cont__breakhead">Gastos</p>
                  {Object.entries(stats.gastosPorCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                    <div className="cont__breakrow cont__breakrow--out" key={c}><em>{c}</em><b>{fmtMoney(v, cur)}</b></div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="cont__panel" data-testid="cont-table-panel">
            <h3><ListFilter size={16} /> Movimientos · {cur}</h3>
            <div className="cont__filters">
              <select className="vera-select" value={fltTipo} data-testid="cont-flt-tipo" onChange={(e) => setFltTipo(e.target.value)}>
                <option value="">Todos los tipos</option><option value="ingreso">Solo ingresos</option><option value="gasto">Solo gastos</option>
              </select>
              <select className="vera-select" value={fltCat} data-testid="cont-flt-cat" onChange={(e) => setFltCat(e.target.value)}>
                <option value="">Todas las categorías</option>{catsFiltro.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {movimientos.length === 0 ? (
              <p className="cont__empty">Sin movimientos con esos filtros.</p>
            ) : (
              <table className="cont__table">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Monto</th><th /></tr></thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id} data-testid={`cont-mov-${m.id}`}>
                      <td>{fmtDate(m.fecha)}</td>
                      <td><span className={`cont__pill cont__pill--${m.tipo === 'ingreso' ? 'in' : 'out'}`}>{m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
                      <td>{m.categoria}
                        {m.origen === 'alquiler' && <span className="cont__auto">auto</span>}
                        {m.recurrente && <span className="cont__auto cont__auto--fijo">fijo</span>}
                      </td>
                      <td>{m.descripcion || '—'}</td>
                      <td style={{ textAlign: 'right' }} className={m.tipo === 'ingreso' ? 'cont__monto--in' : 'cont__monto--out'}>
                        {m.tipo === 'ingreso' ? '+' : '−'}{fmtMoney(m.monto, m.moneda)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.origen === 'manual' && <button type="button" className="cont__del" data-testid={`cont-del-${m.id}`} onClick={() => delEntry(m.id)}><Trash2 size={15} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ContabilidadScreen;
