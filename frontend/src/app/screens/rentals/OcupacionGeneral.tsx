import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { api, type OcupacionGeneral as OcupacionGeneralData } from './api';
import { MESES_LABEL, OcupacionChart } from './OcupacionChart';
import { VariacionRow } from './VariacionRow';

const cellClass = (pct: number) => (pct >= 60 ? 'ok' : pct >= 30 ? 'mid' : 'low');

/** Ocupación mensual combinada de TODA la cartera de alquileres, con detalle por propiedad. */
export const OcupacionGeneral = () => {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<OcupacionGeneralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    api.ocupacionGeneral(`${anio}-01`, `${anio}-12`)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) { setData(null); setError('No se pudo cargar la ocupación.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [anio]);

  const chartData = useMemo(() => (data?.general || []).map((m) => ({
    label: MESES_LABEL[Number(m.mes.split('-')[1]) - 1], pct: m.pct, ocupadas: m.ocupadas, disponibles: m.disponibles,
  })), [data]);

  // Promedio ponderado por noches disponibles (ver nota en OcupacionPropiedad.tsx).
  const promedio = useMemo(() => {
    const t = (data?.general || []).reduce((acc, m) => ({ ocupadas: acc.ocupadas + m.ocupadas, disponibles: acc.disponibles + m.disponibles }), { ocupadas: 0, disponibles: 0 });
    return t.disponibles > 0 ? Math.round((t.ocupadas / t.disponibles) * 1000) / 10 : 0;
  }, [data]);

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
      {loading ? <p className="rt-hint">Calculando…</p> : error ? (
        <p className="rt-hint rt-hint--error" data-testid="rt-ocupgen-error">{error}</p>
      ) : (
        <>
          <p className="rt-ocup__avg" data-testid="rt-ocupgen-promedio">Promedio {anio}: <strong>{promedio}%</strong></p>
          <OcupacionChart data={chartData} />
          <VariacionRow anio={anio} items={(data?.general || []).map((m) => ({ label: MESES_LABEL[Number(m.mes.split('-')[1]) - 1], variacion: m.variacion }))} />
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
