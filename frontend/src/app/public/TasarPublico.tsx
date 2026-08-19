import { useState } from 'react';
import { Sparkles, TrendingUp, ShieldCheck, Loader2 } from 'lucide-react';
import { env } from '@vera/config';
import { usePageMeta, SITE_URL } from './usePageMeta';

const API = `${env.backendUrl}/api/public/tasacion`;

const ZONAS = [
  ['costanera', 'Av. Costanera'], ['zonamar', 'Zona Mar'], ['av2camelias', 'Av. 2 y Camelias'],
  ['interbalnearia', 'Av. Interbalnearia'], ['bosque', 'Zona Bosque'], ['fondo', 'Zona Fondo'],
];
const TIPOS = [['casa', 'Casa'], ['duplex', 'Duplex'], ['lote', 'Lote / Terreno'], ['depto', 'Departamento']];

interface Estimate {
  estMin: number; estMax: number; method: string;
  tipoNombre: string; zonaNombre: string; area: number | null;
  market: { available: boolean; count: number; medianPm2: number };
  leadSaved: boolean;
}

const usd = (n: number) => 'USD ' + n.toLocaleString('de-DE');

const Sel = ({ label, value, onChange, options, testid }: {
  label: string; value: string; onChange: (v: string) => void; options: string[][]; testid: string;
}) => (
  <label className="tasp-field">
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

const Num = ({ label, value, onChange, testid }: {
  label: string; value: string; onChange: (v: string) => void; testid: string;
}) => (
  <label className="tasp-field">
    <span>{label}</span>
    <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
  </label>
);

const Chk = ({ label, checked, onChange, testid }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; testid: string;
}) => (
  <label className="tasp-chk" data-testid={testid}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

export const TasarPublico = () => {
  const [f, setF] = useState({
    tipo: 'casa', zona: 'costanera', cubiertos: '', lote: '',
    calidad: 'estandar', estado: 'bueno', antiguedad: 'hasta10',
    ambientes: '2', vista: 'frente', antDepto: 'reciente',
    gas: false, cloacas: false, pileta: false, quincho: false, deck: false,
    estacCub: false, estacDesc: false, galeria: false,
    nombre: '', telefono: '', email: '',
  });
  const [result, setResult] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, val: string | boolean) => setF((s) => ({ ...s, [k]: val }));

  usePageMeta({
    title: 'Tasación online gratuita en Costa del Este | Varela',
    description: 'Tasá tu propiedad en Costa del Este o Mar del Tuyú en minutos, sin costo y sin compromiso.',
    canonical: `${SITE_URL}/tasar`,
  });

  const esCasa = f.tipo === 'casa' || f.tipo === 'duplex';
  const esDepto = f.tipo === 'depto';
  const esLote = f.tipo === 'lote';

  const estimar = async () => {
    setError('');
    if (!f.nombre.trim() || !f.telefono.trim()) {
      setError('Completá tu nombre y teléfono para recibir la estimación.');
      return;
    }
    if (esLote && !f.lote) { setError('Cargá la superficie del lote.'); return; }
    if (!esLote && !f.cubiertos) { setError('Cargá los metros cubiertos.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/estimar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...f,
          cubiertos: f.cubiertos ? Number(f.cubiertos) : null,
          lote: f.lote ? Number(f.lote) : null,
        }),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('No pudimos calcular la estimación. Probá de nuevo en unos minutos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vera-pub tasp" data-testid="tasar-publico">
      <header className="vera-pub__topbar">
        <span className="vera-pub__count">Costa del Este · Mar del Tuyú</span>
        <img src="/varela-logo-brand.png" alt="Varela Inmobiliaria" style={{ height: 34, width: 'auto' }} data-testid="tasar-logo" />
      </header>

      {result ? (
        <section className="tasp__result-wrap" data-testid="tasp-result">
          <div className="tasp__result-card">
            <span className="tasp__result-tag"><TrendingUp size={15} /> Valor estimado de tu propiedad</span>
            <strong className="tasp__result-range" data-testid="tasp-range">
              {usd(result.estMin)} – {usd(result.estMax)}
            </strong>
            <p className="tasp__result-meta">
              {result.tipoNombre} · {result.zonaNombre}{result.area ? ` · ${result.area} m²` : ''}
            </p>
            {result.market.available ? (
              <p className="tasp__result-note" data-testid="tasp-market">
                Basado en <b>{result.market.count}</b> propiedades comparables publicadas hoy en la zona
                {' '}(promedio {usd(result.market.medianPm2)}/m²) combinadas con nuestro modelo de valuación local.
              </p>
            ) : (
              <p className="tasp__result-note">Estimación calculada con nuestro modelo de valuación local de Costa del Este.</p>
            )}
            <div className="tasp__result-cta">
              <ShieldCheck size={16} />
              <span>Un asesor de Varela se va a contactar con vos para una tasación precisa y sin cargo.</span>
            </div>
            <button type="button" className="tasp__again" onClick={() => setResult(null)} data-testid="tasp-again">
              Estimar otra propiedad
            </button>
          </div>
          <p className="tasp__disclaimer">
            * Estimación orientativa basada en datos públicos del mercado. El valor real depende del estado,
            la ubicación exacta y la coyuntura. La tasación definitiva la realiza un asesor.
          </p>
        </section>
      ) : (
        <section className="tasp__form-wrap">
          <div className="vera-pub__hero tasp__hero">
            <h1 className="vera-pub__h1">¿Cuánto vale tu propiedad?</h1>
            <p className="vera-pub__sub">
              Estimá el valor de tu casa, lote o departamento en Costa del Este con datos reales del mercado. Gratis y en segundos.
            </p>
          </div>

          <div className="tasp__form" data-testid="tasp-form">
            <h3 className="tasp__section">Tu propiedad</h3>
            <div className="tasp__row2">
              <Sel label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} options={TIPOS} testid="tasp-tipo" />
              <Sel label="Zona" value={f.zona} onChange={(v) => set('zona', v)} options={ZONAS} testid="tasp-zona" />
            </div>
            <div className="tasp__row2">
              {!esDepto && <Num label="Superficie del lote (m²)" value={f.lote} onChange={(v) => set('lote', v)} testid="tasp-lote" />}
              {!esLote && <Num label={esDepto ? 'Superficie cubierta (m²)' : 'Metros cubiertos (m²)'} value={f.cubiertos} onChange={(v) => set('cubiertos', v)} testid="tasp-cubiertos" />}
            </div>

            {esCasa && (
              <div className="tasp__row2">
                <Sel label="Calidad" value={f.calidad} onChange={(v) => set('calidad', v)} testid="tasp-calidad"
                  options={[['economica', 'Económica'], ['estandar', 'Estándar'], ['superior', 'Superior'], ['premium', 'Premium']]} />
                <Sel label="Estado" value={f.estado} onChange={(v) => set('estado', v)} testid="tasp-estado"
                  options={[['reciclar', 'A reciclar'], ['bueno', 'Bueno'], ['muybueno', 'Muy bueno'], ['excelente', 'Excelente']]} />
                <Sel label="Antigüedad" value={f.antiguedad} onChange={(v) => set('antiguedad', v)} testid="tasp-antiguedad"
                  options={[['estrenar', 'A estrenar'], ['hasta10', 'Hasta 10 años'], ['diez25', '10 a 25'], ['mas25', 'Más de 25']]} />
              </div>
            )}
            {esDepto && (
              <div className="tasp__row2">
                <Sel label="Ambientes" value={f.ambientes} onChange={(v) => set('ambientes', v)} testid="tasp-ambientes"
                  options={[['1', '1 amb'], ['2', '2 amb'], ['3', '3 amb'], ['4', '4+ amb']]} />
                <Sel label="Vista" value={f.vista} onChange={(v) => set('vista', v)} testid="tasp-vista"
                  options={[['frente', 'Al frente'], ['lateral', 'Lateral'], ['contrafrente', 'Contrafrente']]} />
                <Sel label="Antigüedad" value={f.antDepto} onChange={(v) => set('antDepto', v)} testid="tasp-antdepto"
                  options={[['estrenar', 'A estrenar'], ['reciente', 'Reciente'], ['antiguo', 'Antiguo']]} />
              </div>
            )}

            {!esLote && (
              <>
                <h3 className="tasp__section">Servicios y amenities</h3>
                <div className="tasp__chks">
                  <Chk label="Gas natural" checked={f.gas} onChange={(v) => set('gas', v)} testid="tasp-gas" />
                  <Chk label="Cloacas" checked={f.cloacas} onChange={(v) => set('cloacas', v)} testid="tasp-cloacas" />
                  <Chk label="Pileta" checked={f.pileta} onChange={(v) => set('pileta', v)} testid="tasp-pileta" />
                  <Chk label="Quincho" checked={f.quincho} onChange={(v) => set('quincho', v)} testid="tasp-quincho" />
                  <Chk label="Deck" checked={f.deck} onChange={(v) => set('deck', v)} testid="tasp-deck" />
                  <Chk label="Cochera cubierta" checked={f.estacCub} onChange={(v) => set('estacCub', v)} testid="tasp-estaccub" />
                </div>
              </>
            )}

            <h3 className="tasp__section">Tus datos</h3>
            <p className="tasp__hint">Te enviamos la estimación y un asesor te contacta para la tasación definitiva.</p>
            <div className="tasp__row2">
              <label className="tasp-field"><span>Nombre y apellido *</span>
                <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} data-testid="tasp-nombre" /></label>
              <label className="tasp-field"><span>Teléfono / WhatsApp *</span>
                <input value={f.telefono} onChange={(e) => set('telefono', e.target.value)} data-testid="tasp-telefono" /></label>
            </div>
            <label className="tasp-field"><span>Email (opcional)</span>
              <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} data-testid="tasp-email" /></label>

            {error && <p className="tasp__error" data-testid="tasp-error">{error}</p>}

            <button type="button" className="tasp__submit" onClick={estimar} disabled={loading} data-testid="tasp-submit">
              {loading ? <><Loader2 size={17} className="tasp__spin" /> Calculando…</> : <><Sparkles size={17} /> Ver el valor estimado</>}
            </button>
            <p className="tasp__legal">Al continuar aceptás ser contactado por Varela Propiedades.</p>
          </div>
        </section>
      )}

      <footer className="vera-pub__footer">Publicado con VERA OS</footer>
    </div>
  );
};

export default TasarPublico;
