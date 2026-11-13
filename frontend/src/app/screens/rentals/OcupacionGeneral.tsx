import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { api, type OcupacionGeneral as OcupacionGeneralData } from './api';

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const colorPct = (pct: number) => (pct >= 60 ? '#4bbf6b' : pct >= 30 ? '#d6aa28' : '#6b6b6b');
const cellClass = (pct: number) => (pct >= 60 ? 'ok' : pct >= 30 ? 'mid' : 'low');

/** Ocupación mensual combinada de TODA la cartera de alquileres, con detalle por propiedad. */
export const OcupacionGeneral = () => {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<OcupacionGeneralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.ocupacionGeneral(`${anio}-01`, `${anio}-12`)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [anio]);

  const chartData = useMemo(() => (data?.general || []).map((m) => ({
    label: MESES_LABEL[Number(m.mes.split('-')[1]) - 1], pct: m.pct,
  })), [data]);

  const promedio = data?.general.length
    ? Math.round((data.general.reduce((s, m) => s + m.pct, 0) / data.general.length) * 10) / 10
    : 0;
  const propsConDatos = (data?.propiedades || []).filter((p) => p.meses.some((m) => m.disponibles > 0));

  return (
    <div className="rt-ocupgen" data-testid="rt-ocupacion-general">
      <div className="rt-ocupgen__head">
        <div>
          <h3><CalendarRange size={16} /> Ocupación de la cartera</h3>
          <p className="rt__sub">% de noches reservadas sobre noches disponibles, mes a mes.</p>
        </div>
        <div className="rt-ocup__year">
          <button type="button" onClick={() => setAnio((a) => a - 1)} data-testid="rt-ocupgen-prev-year"><ChevronLeft size={14} /></button>
          <span data-testid="rt-ocupgen-year">{anio}</span>
          <button type="button" onClick={() => setAnio((a) => a + 1)} data-testid="rt-ocupgen-next-year"><ChevronRight size={14} /></button>
        </div>
      </div>
      {loading ? <p className="rt-hint">Calculando…</p> : (
        <>
          <p className="rt-ocup__avg" data-testid="rt-ocupgen-promedio">Promedio {anio}: <strong>{promedio}%</strong></p>
          <div className="rt-ocup__chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value?: number) => `${value ?? 0}%`} contentStyle={{ background: '#1b1b1e', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#eee' }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={colorPct(d.pct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {propsConDatos.length > 0 && (
            <>
              <button type="button" className="rt-ocupgen__toggle" onClick={() => setExpanded((e) => !e)} data-testid="rt-ocupgen-toggle-detalle">
                {expanded ? 'Ocultar detalle por propiedad' : 'Ver detalle por propiedad'}
              </button>
              {expanded && (
                <div className="rt-ocupgen__table-wrap">
                  <table className="rt-ocupgen__table" data-testid="rt-ocupgen-table">
                    <thead>
                      <tr><th>Propiedad</th>{MESES_LABEL.map((m) => <th key={m}>{m}</th>)}</tr>
                    </thead>
                    <tbody>
                      {propsConDatos.map((p) => (
                        <tr key={p.propertyId} data-testid={`rt-ocupgen-row-${p.propertyId}`}>
                          <td>{p.codigo ? `${p.codigo} · ` : ''}{p.titulo}</td>
                          {p.meses.map((m) => (
                            <td key={m.mes} className={m.disponibles > 0 ? cellClass(m.pct) : 'na'}>
                              {m.disponibles > 0 ? `${m.pct}%` : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default OcupacionGeneral;
