import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const colorPct = (pct: number) => (pct >= 60 ? '#4bbf6b' : pct >= 30 ? '#d6aa28' : 'rgba(255,255,255,0.32)');

export interface OcupacionBar { label: string; pct: number; ocupadas?: number; disponibles?: number; }

/** Gráfico de barras compartido por los paneles de ocupación (general y por propiedad). */
export const OcupacionChart = ({ data }: { data: OcupacionBar[] }) => (
  <div className="rt-ocup__chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          formatter={(value: number | undefined, _name?: unknown, item?: { payload?: OcupacionBar }) => {
            const p = item?.payload;
            const detalle = p && p.disponibles != null ? ` (${p.ocupadas}/${p.disponibles} noches)` : '';
            return [`${value ?? 0}%${detalle}`, 'Ocupación'] as [string, string];
          }}
          contentStyle={{ background: '#1b1b1e', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#eee' }}
        />
        <Bar dataKey="pct" name="Ocupación" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={colorPct(d.pct)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default OcupacionChart;
