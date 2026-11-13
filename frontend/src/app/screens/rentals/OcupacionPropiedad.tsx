import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { api, type OcupacionMes } from './api';

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const colorPct = (pct: number) => (pct >= 60 ? '#4bbf6b' : pct >= 30 ? '#d6aa28' : '#6b6b6b');

/** Ocupación mensual de ESTA propiedad: noches reservadas sobre noches disponibles. */
export const OcupacionPropiedad = ({ propertyId }: { propertyId: string }) => {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [meses, setMeses] = useState<OcupacionMes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.ocupacionPropiedad(propertyId, `${anio}-01`, `${anio}-12`)
      .then((d) => { if (alive) setMeses(d.meses); })
      .catch(() => { if (alive) setMeses([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [propertyId, anio]);

  const chartData = useMemo(() => meses.map((m) => ({
    label: MESES_LABEL[Number(m.mes.split('-')[1]) - 1], pct: m.pct, ocupadas: m.ocupadas, disponibles: m.disponibles,
  })), [meses]);

  const promedio = meses.length ? Math.round((meses.reduce((s, m) => s + m.pct, 0) / meses.length) * 10) / 10 : 0;

  return (
    <section className="rt-ws__full rt-ocup" data-testid="rt-ocupacion-propiedad">
      <div className="rt-ws__sechead">
        <h3 className="rt-ws__sec"><CalendarDays size={14} /> Ocupación por mes</h3>
        <div className="rt-ocup__year">
          <button type="button" onClick={() => setAnio((a) => a - 1)} data-testid="rt-ocup-prev-year"><ChevronLeft size={14} /></button>
          <span data-testid="rt-ocup-year">{anio}</span>
          <button type="button" onClick={() => setAnio((a) => a + 1)} data-testid="rt-ocup-next-year"><ChevronRight size={14} /></button>
        </div>
      </div>
      {loading ? <p className="rt-hint">Calculando…</p> : (
        <>
          <p className="rt-ocup__avg" data-testid="rt-ocup-promedio">Promedio {anio}: <strong>{promedio}%</strong></p>
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
        </>
      )}
    </section>
  );
};

export default OcupacionPropiedad;
