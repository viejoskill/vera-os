import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, Users, Megaphone, MessageCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { env } from '@vera/config';
import { useAuthUser } from '@app/auth/useAuthUser';
import './estadisticas.css';

interface Summary {
  days: number;
  totalVisits: number;
  uniqueVisitors: number;
  visitsFromAds: number;
  whatsappConsultas: number;
  visitsByDay: { date: string; count: number }[];
  topPages: { path: string; section: string; code: string | null; count: number }[];
  topProperties: { propertyId: string; code: string; section: string; count: number }[];
}

const PRESETS: { key: number; label: string }[] = [
  { key: 7, label: 'Últimos 7 días' },
  { key: 30, label: 'Últimos 30 días' },
  { key: 90, label: 'Últimos 90 días' },
];

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const pageLabel = (page: { path: string; section: string; code: string | null }) => {
  const { path, section, code } = page;
  if (code) return `Ficha de ${section === 'alquileres' ? 'alquiler' : 'venta'} (${code})`;
  if (path === '/' || path === '/inicio') return `Inicio (${section === 'alquileres' ? 'Alquileres' : 'Ventas'})`;
  if (path === '/web') return 'Cartera de ventas';
  if (path === '/alquileres' || path === '/alquileres/') return 'Alquileres (listado)';
  if (path === '/tasar') return 'Tasación online';
  if (path.startsWith('/venta/')) return 'Landing de zona';
  return path;
};

/** Panel de estadísticas del CRM: visitas a la web (propias, sin servicios externos)
 * + cuántas de esas visitas llegaron desde un anuncio de Google + consultas por
 * WhatsApp registradas. Solo visible para administradores. */
export const EstadisticasScreen = () => {
  const { email } = useAuthUser();
  const [days, setDays] = useState(30);

  const { data, isLoading, isError } = useQuery<Summary>({
    queryKey: ['analytics-summary', email, days],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/analytics/summary?actorEmail=${encodeURIComponent(email)}&days=${days}`);
      if (!res.ok) throw new Error('No se pudieron cargar las estadísticas.');
      return res.json();
    },
    enabled: !!email,
  });

  const chartData = (data?.visitsByDay || []).map((d) => ({ label: fmtDay(d.date), Visitas: d.count }));

  return (
    <div className="est" data-testid="estadisticas-screen">
      <header className="est__head">
        <div>
          <h1 className="est__title"><BarChart3 size={20} /> Estadísticas</h1>
          <p className="est__sub">
            Visitas a la web pública (Ventas y Alquileres), cuántas llegan desde un anuncio de Google
            y las consultas por WhatsApp registradas. Solo vos podés ver esta sección.
          </p>
        </div>
        <div className="est__presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`est__preset ${days === p.key ? 'on' : ''}`}
              onClick={() => setDays(p.key)}
              data-testid={`est-preset-${p.key}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading && <p className="est__loading" data-testid="est-loading">Cargando estadísticas…</p>}
      {isError && <p className="est__loading" data-testid="est-error">No se pudieron cargar las estadísticas.</p>}

      {data && (
        <>
          <div className="est__cards">
            <div className="est__card" data-testid="est-card-visits">
              <span><Eye size={14} /> Visitas totales</span>
              <strong>{data.totalVisits.toLocaleString('es-AR')}</strong>
            </div>
            <div className="est__card" data-testid="est-card-visitors">
              <span><Users size={14} /> Visitantes únicos</span>
              <strong>{data.uniqueVisitors.toLocaleString('es-AR')}</strong>
            </div>
            <div className="est__card est__card--ads" data-testid="est-card-ads">
              <span><Megaphone size={14} /> Desde un anuncio de Google</span>
              <strong>{data.visitsFromAds.toLocaleString('es-AR')}</strong>
            </div>
            <div className="est__card est__card--whatsapp" data-testid="est-card-whatsapp">
              <span><MessageCircle size={14} /> Consultas por WhatsApp</span>
              <strong>{data.whatsappConsultas.toLocaleString('es-AR')}</strong>
            </div>
          </div>

          <div className="est__grid2">
            <div className="est__panel" data-testid="est-chart">
              <h3><BarChart3 size={16} /> Visitas por día</h3>
              <div className="est__chartwrap">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="estVisitas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d6aa28" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#d6aa28" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#9a968c', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#1b1b1e', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#eee' }} />
                      <Area type="monotone" dataKey="Visitas" stroke="#d6aa28" fill="url(#estVisitas)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="est__empty" data-testid="est-chart-empty">Todavía no hay visitas registradas en este período.</p>
                )}
              </div>
            </div>
          </div>

          <div className="est__lists">
            <div className="est__panel" data-testid="est-top-pages">
              <h3><Eye size={16} /> Páginas más visitadas</h3>
              {data.topPages.length > 0 ? (
                <ul className="est__list">
                  {data.topPages.map((p) => (
                    <li key={`${p.path}-${p.section}-${p.code || ''}`} data-testid={`est-page-${p.code || p.path}`}>
                      <span className="est__list-label">{pageLabel(p)}</span>
                      <span className="est__list-count">{p.count}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="est__empty">Sin datos todavía.</p>}
            </div>
            <div className="est__panel" data-testid="est-top-properties">
              <h3><BarChart3 size={16} /> Propiedades más vistas</h3>
              {data.topProperties.length > 0 ? (
                <ul className="est__list">
                  {data.topProperties.map((p) => (
                    <li key={p.propertyId} data-testid={`est-property-${p.propertyId}`}>
                      <span className="est__list-label">
                        <span className="est__list-badge">{p.section === 'alquileres' ? 'Alquiler' : 'Venta'}</span>
                        {p.code || p.propertyId}
                      </span>
                      <span className="est__list-count">{p.count}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="est__empty">Sin datos todavía.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
