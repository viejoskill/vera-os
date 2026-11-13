import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { api, type OcupacionMes } from './api';
import { MESES_LABEL, OcupacionChart } from './OcupacionChart';
import { VariacionRow } from './VariacionRow';

/** Ocupación mensual de ESTA propiedad: noches reservadas sobre noches disponibles. */
export const OcupacionPropiedad = ({ propertyId }: { propertyId: string }) => {
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [meses, setMeses] = useState<OcupacionMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    api.ocupacionPropiedad(propertyId, `${anio}-01`, `${anio}-12`)
      .then((d) => { if (alive) setMeses(d.meses); })
      .catch(() => { if (alive) { setMeses([]); setError('No se pudo cargar la ocupación.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [propertyId, anio]);

  const chartData = useMemo(() => meses.map((m) => ({
    label: MESES_LABEL[Number(m.mes.split('-')[1]) - 1], pct: m.pct, ocupadas: m.ocupadas, disponibles: m.disponibles,
  })), [meses]);

  // Promedio ponderado por noches disponibles: un mes totalmente bloqueado (disponibles=0)
  // no debe pesar como "0% de ocupación" y arrastrar el promedio hacia abajo.
  const { ocupadasTot, disponiblesTot } = useMemo(
    () => meses.reduce((acc, m) => ({ ocupadasTot: acc.ocupadasTot + m.ocupadas, disponiblesTot: acc.disponiblesTot + m.disponibles }), { ocupadasTot: 0, disponiblesTot: 0 }),
    [meses],
  );
  const promedio = disponiblesTot > 0 ? Math.round((ocupadasTot / disponiblesTot) * 1000) / 10 : 0;

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
      {loading ? <p className="rt-hint">Calculando…</p> : error ? (
        <p className="rt-hint rt-hint--error" data-testid="rt-ocup-error">{error}</p>
      ) : (
        <>
          <p className="rt-ocup__avg" data-testid="rt-ocup-promedio">Promedio {anio}: <strong>{promedio}%</strong></p>
          <OcupacionChart data={chartData} />
          <VariacionRow anio={anio} items={meses.map((m) => ({ label: MESES_LABEL[Number(m.mes.split('-')[1]) - 1], variacion: m.variacion }))} />
        </>
      )}
    </section>
  );
};

export default OcupacionPropiedad;
