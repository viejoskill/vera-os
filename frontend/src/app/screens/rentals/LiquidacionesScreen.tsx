import { useEffect, useState } from 'react';
import { FileText, Calculator, Download } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, TIPO_MOV, type RentalProperty, type Liquidacion } from './api';
import './rentals.css';

export const LiquidacionesScreen = () => {
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [pid, setPid] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [liq, setLiq] = useState<Liquidacion | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.listProperties().then((p) => { setProps(p); if (p[0]) setPid(p[0].id); }); }, []);

  const generar = async () => {
    if (!pid || !desde || !hasta) { setErr('Elegí propiedad y período.'); return; }
    setErr('');
    try { setLiq(await api.liquidacion(pid, desde, hasta)); } catch (e) { setErr((e as Error).message); }
  };

  const mon = liq?.propiedad.moneda || 'ARS';

  return (
    <div className="vera-screen rt" data-testid="liquidaciones-screen">
      <header className="rt__head">
        <div>
          <h2 className="rt__title"><Calculator size={20} /> Liquidaciones al propietario</h2>
          <p className="rt__sub">Elegí una propiedad y un período. VERA calcula el neto a liquidar: alquileres cobrados − comisión − gastos a cargo del propietario.</p>
        </div>
      </header>

      <div className="rt-liq__filters" data-testid="rt-liq-filters">
        <select value={pid} onChange={(e) => setPid(e.target.value)} data-testid="rt-liq-prop">
          {props.map((p) => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.titulo}</option>)}
        </select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} data-testid="rt-liq-desde" />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} data-testid="rt-liq-hasta" />
        <Button variant="primary" size="md" onClick={generar} data-testid="rt-liq-generar"><FileText size={16} /> Generar</Button>
      </div>
      {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}

      {liq && (
        <div className="rt-liq" data-testid="rt-liq-result">
          <div className="rt-liq__head">
            <div>
              <h3>{liq.propiedad.codigo} · {liq.propiedad.titulo}</h3>
              <p>Propietario: <strong>{liq.propietario.nombre || '—'}</strong>{liq.propietario.telefono ? ` · ${liq.propietario.telefono}` : ''}</p>
              <p className="rt-hint">Período {liq.periodo.desde} → {liq.periodo.hasta}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => window.open(api.liquidacionPdfUrl(pid, desde, hasta), '_blank')} data-testid="rt-liq-pdf"><Download size={15} /> Descargar PDF</Button>
          </div>
          <div className="rt-liq__grid">
            <div className="rt-liq__cell"><span>Alquileres cobrados</span><strong>{fmtMoney(liq.ingresos, mon)}</strong></div>
            <div className="rt-liq__cell"><span>− Comisión</span><strong>-{fmtMoney(liq.comision, mon)}</strong></div>
            <div className="rt-liq__cell"><span>− Gastos del propietario</span><strong>-{fmtMoney(liq.gastosPropietario, mon)}</strong></div>
            <div className="rt-liq__cell rt-liq__cell--net"><span>Neto a liquidar</span><strong data-testid="rt-liq-neto">{fmtMoney(liq.netoPropietario, mon)}</strong></div>
          </div>
          <p className="rt-hint">Gastos a cargo de la agencia en el período: {fmtMoney(liq.gastosNuestros, mon)} (no se descuentan al propietario).</p>
          <div className="rt-mov">
            {liq.movimientos.map((m) => (
              <div className={`rt-mov__row rt-mov__row--${m.tipo}`} key={m.id}>
                <span className="rt-mov__fecha">{m.fecha}</span>
                <span className="rt-mov__tipo">{TIPO_MOV[m.tipo] || m.tipo}</span>
                <span className="rt-mov__desc">{m.descripcion}</span>
                <span className="rt-mov__monto">{fmtMoney(m.monto, mon)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidacionesScreen;
