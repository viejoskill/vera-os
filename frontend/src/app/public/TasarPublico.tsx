import { useState } from 'react';
import { Sparkles, TrendingUp, ShieldCheck, Loader2 } from 'lucide-react';
import { env } from '@vera/config';
import { usePageMeta, SITE_URL } from './usePageMeta';
import { MapaZonas, ZONAS_TASADOR } from './MapaZonas';

const API = `${env.backendUrl}/api/public/tasacion`;

const ZONAS = ZONAS_TASADOR;
const TIPOS = [['casa', 'Casa'], ['duplex', 'Duplex'], ['lote', 'Lote / Terreno'], ['depto', 'Departamento']];

interface SemaforoTier {
  nivel: 'verde' | 'amarillo' | 'rojo';
  meses: string;
  ajuste: number;
  valor: number;
}
interface Estimate {
  estMin: number; estMax: number; method: string;
  mktMin: number; mktMax: number; base: number;
  semaforo: SemaforoTier[];
  tipoNombre: string; zonaNombre: string; area: number | null;
  market: { available: boolean; count: number; medianPm2: number };
  leadSaved: boolean;
}

const SEMAFORO_META: Record<SemaforoTier['nivel'], { titulo: string; dot: string; ring: string; bg: string }> = {
  verde: { titulo: 'Venta rápida', dot: '#22c55e', ring: 'rgba(34,197,94,0.4)', bg: 'rgba(34,197,94,0.08)' },
  amarillo: { titulo: 'Venta media', dot: '#f5c518', ring: 'rgba(245,197,24,0.4)', bg: 'rgba(245,197,24,0.08)' },
  rojo: { titulo: 'Venta lenta', dot: '#ef4444', ring: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.08)' },
};

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
  const sim = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sim') === '1';
  const [f, setF] = useState({
    tipo: 'casa', zona: 'playa', cubiertos: '', lote: '',
    calidad: 'estandar', estado: 'bueno', antiguedad: 'hasta10',
    ambientes: '2', vista: 'frente', antDepto: 'reciente',
    gas: false, cloacas: false, pileta: false, quincho: false, deck: false,
    estacCub: false, estacDesc: false, galeria: false, cercaniaMar: false,
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
    if (!sim && (!f.nombre.trim() || !f.telefono.trim())) {
      setError('Completá tu nombre y teléfono para recibir la estimación.');
      return;
    }
    if (esLote && !f.lote) { setError('Cargá la superficie del lote.'); return; }
    if (!esLote && !f.cubiertos) { setError('Cargá los metros cubiertos.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/${sim ? 'simular' : 'estimar'}`, {
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

      {sim && (
        <div data-testid="tasp-sim-banner" style={{ margin: '0 auto 8px', maxWidth: 720, background: 'rgba(246,230,58,0.1)', border: '1px solid rgba(246,230,58,0.35)', color: '#e9e4b0', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          🧪 Modo simulador — para calibrar el tasador. <span style={{ fontWeight: 400 }}>No genera contactos ni guarda tasaciones.</span>
        </div>
      )}

      {result ? (
        <section className="tasp__result-wrap" data-testid="tasp-result">
          <div className="tasp__result-card">
            <span className="tasp__result-tag"><TrendingUp size={15} /> Valor de referencia de mercado</span>
            <strong className="tasp__result-range" data-testid="tasp-range">
              {usd(result.mktMin)} – {usd(result.mktMax)}
            </strong>
            <p className="tasp__result-meta">
              {result.tipoNombre} · {result.zonaNombre}{result.area ? ` · ${result.area} m²` : ''}
            </p>
            {result.market.available ? (
              <p className="tasp__result-note" data-testid="tasp-market">
                Índice de mercado según <b>{result.market.count}</b> propiedades comparables publicadas hoy en la zona
                {' '}(promedio {usd(result.market.medianPm2)}/m²).
              </p>
            ) : (
              <p className="tasp__result-note">Índice de mercado estimado con nuestro modelo de valuación local de Costa del Este.</p>
            )}
          </div>

          <div className="tasp__semaforo" data-testid="tasp-semaforo">
            <span className="tasp__semaforo-tag">Índice Varela de venta</span>
            <p className="tasp__semaforo-sub">Precio de venta sugerido según en cuánto tiempo querés vender.</p>
            <div className="tasp__semaforo-grid">
              {(result.semaforo || []).map((t) => {
                const m = SEMAFORO_META[t.nivel];
                return (
                  <div
                    key={t.nivel}
                    className="tasp__tier"
                    data-testid={`tasp-tier-${t.nivel}`}
                    style={{ borderColor: m.ring, background: m.bg }}
                  >
                    <span className="tasp__tier-head">
                      <span className="tasp__tier-dot" style={{ background: m.dot }} />
                      <b>{m.titulo}</b>
                    </span>
                    <span className="tasp__tier-meses">{t.meses}</span>
                    <strong className="tasp__tier-valor" data-testid={`tasp-tier-valor-${t.nivel}`}>{usd(t.valor)}</strong>
                    <span className="tasp__tier-ajuste">
                      {t.ajuste === 0 ? 'Precio de mercado' : `${Math.round(t.ajuste * 100)}% vs. mercado`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="tasp__semaforo-note" data-testid="tasp-semaforo-note">
              En base a precios reales de venta en Costa del Este de los últimos 12 meses.
            </p>
          </div>

          <div className="tasp__result-card tasp__result-card--cta">
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
            <p className="tasp__hint" style={{ marginTop: -4 }}>Tocá tu zona en el mapa (o elegila en la lista más abajo).</p>
            <MapaZonas value={f.zona} onChange={(v) => set('zona', v)} />
            <div className="tasp__row2">
              <Sel label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} options={TIPOS} testid="tasp-tipo" />
              <Sel label="Zona (lista)" value={f.zona} onChange={(v) => set('zona', v)} options={ZONAS} testid="tasp-zona" />
            </div>
            <div className="tasp__row2">
              {!esDepto && <Num label="Superficie del lote (m²)" value={f.lote} onChange={(v) => set('lote', v)} testid="tasp-lote" />}
              {!esLote && <Num label={esDepto ? 'Superficie cubierta (m²)' : 'Metros cubiertos (m²)'} value={f.cubiertos} onChange={(v) => set('cubiertos', v)} testid="tasp-cubiertos" />}
            </div>
            <Chk label="A menos de 200m del mar" checked={f.cercaniaMar} onChange={(v) => set('cercaniaMar', v)} testid="tasp-cercania-mar" />

            {esCasa && (
              <div className="tasp__row2">
                <Sel label="Calidad" value={f.calidad} onChange={(v) => set('calidad', v)} testid="tasp-calidad"
                  options={[['economica', 'Económica'], ['estandar', 'Estándar'], ['estandar_plus', 'Estándar Plus'], ['superior', 'Superior'], ['premium', 'Premium']]} />
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

            {!sim && (
            <>
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
            </>
            )}

            {error && <p className="tasp__error" data-testid="tasp-error">{error}</p>}

            <button type="button" className="tasp__submit" onClick={estimar} disabled={loading} data-testid="tasp-submit">
              {loading ? <><Loader2 size={17} className="tasp__spin" /> Calculando…</> : <><Sparkles size={17} /> {sim ? 'Simular valor' : 'Ver el valor estimado'}</>}
            </button>
            {!sim && <p className="tasp__legal">Al continuar aceptás ser contactado por Varela Propiedades.</p>}
          </div>
        </section>
      )}

      <footer className="vera-pub__footer">Publicado con VERA OS</footer>
    </div>
  );
};

export default TasarPublico;
