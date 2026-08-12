import { useState } from 'react';
import { Calculator, Download, UserPlus, Sparkles, Share2, Check } from 'lucide-react';
import { Input, Button } from '@vera/ui';
import { env } from '@vera/config';
import { useAuthUser } from '@app/auth/useAuthUser';
import { TasadorConfig } from '@app/screens/TasadorConfig';

const API = `${env.backendUrl}/api/tasacion`;

const ZONAS = [
  ['costanera', 'Av. Costanera'], ['zonamar', 'Zona Mar'], ['av2camelias', 'Av. 2 y Camelias'],
  ['interbalnearia', 'Av. Interbalnearia'], ['bosque', 'Zona Bosque'], ['fondo', 'Zona Fondo'],
];
const TIPOS = [['casa', 'Casa'], ['duplex', 'Duplex'], ['lote', 'Lote / Terreno'], ['depto', 'Departamento']];

interface Result {
  pubMin: number; pubMax: number; cierreMin: number; cierreMax: number;
  coef: number; tipoNombre: string; zonaNombre: string;
}

const usd = (n: number) => 'USD ' + n.toLocaleString('de-DE');

const Sel = ({ label, value, onChange, options, testid }: {
  label: string; value: string; onChange: (v: string) => void; options: string[][]; testid: string;
}) => (
  <label className="tas-field">
    <span>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

const Chk = ({ label, checked, onChange, testid }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; testid: string;
}) => (
  <label className="tas-chk" data-testid={testid}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

export const TasacionesScreen = () => {
  const { displayName } = useAuthUser();
  const [f, setF] = useState({
    tipo: 'casa', zona: 'costanera', cubiertos: '', semicubiertos: '', lote: '',
    dormitorios: '', banos: '',
    calidad: 'estandar', estado: 'bueno', antiguedad: 'hasta10',
    ambientes: '2', vista: 'frente', antDepto: 'reciente',
    gas: false, cloacas: false, pileta: false, quincho: false, deck: false,
    estacCub: false, estacDesc: false, galeria: false,
    propietario: '', direccion: '', telefono: '', email: '',
  });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');
  const [copied, setCopied] = useState(false);
  const set = (k: string, val: string | boolean) => setF((s) => ({ ...s, [k]: val }));

  const publicUrl = `${window.location.origin}/tasar`;
  const copyPublic = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(publicUrl, '_blank');
    }
  };

  const payload = () => ({
    ...f,
    cubiertos: f.cubiertos ? Number(f.cubiertos) : null,
    semicubiertos: f.semicubiertos ? Number(f.semicubiertos) : null,
    lote: f.lote ? Number(f.lote) : null,
    dormitorios: f.dormitorios ? Number(f.dormitorios) : null,
    banos: f.banos ? Number(f.banos) : null,
    asesor: displayName,
  });

  const calcular = async () => {
    setLoading(true);
    const res = await fetch(`${API}/calcular`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
    });
    setResult(await res.json());
    setLoading(false);
  };

  const generarJpg = async () => {
    setFlash('Generando imagen…');
    const res = await fetch(`${API}/jpg`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
    });
    const data = await res.json();
    setResult(data.result);
    const a = document.createElement('a');
    a.href = data.image;
    a.download = `tasacion-${f.propietario || 'varela'}.jpg`;
    a.click();
    setFlash('Imagen descargada. Compartila por WhatsApp 📲');
    setTimeout(() => setFlash(''), 4000);
  };

  const guardarLead = async () => {
    if (!f.propietario || !f.telefono) { setFlash('Cargá nombre y teléfono del propietario.'); setTimeout(() => setFlash(''), 3000); return; }
    await fetch(`${env.backendUrl}/api/people/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: f.propietario, phone: f.telefono, whatsapp: f.telefono, email: f.email || undefined, role: 'vendedor' }),
    });
    setFlash('Propietario guardado como lead en Personas ✅');
    setTimeout(() => setFlash(''), 4000);
  };

  const esCasa = f.tipo === 'casa' || f.tipo === 'duplex';
  const esDepto = f.tipo === 'depto';

  return (
    <div className="vera-screen tas" data-testid="tasaciones-screen">
      <header className="tas__head">
        <h2 className="tas__title"><Calculator size={18} /> Tasador manual</h2>
        <p className="tas__sub">Modelo Varela · Costa del Este / Mar del Tuyú. Cargá los datos y generá la tasación para WhatsApp.</p>
        <div className="tas__public" data-testid="tas-public-share">
          <div>
            <strong>Tasador online público</strong>
            <span>Compartí este link: el visitante estima su propiedad (Varela + comparables en vivo de Mercado Libre) y queda como lead en Personas.</span>
          </div>
          <Button variant="secondary" size="sm" onClick={copyPublic} data-testid="tas-copy-public">
            {copied ? <><Check size={15} /> Link copiado</> : <><Share2 size={15} /> Copiar link público</>}
          </Button>
        </div>
      </header>

      <TasadorConfig />

      <div className="tas__grid">
        <section className="tas__col">
          <h3 className="tas__section">Datos de la propiedad</h3>
          <div className="tas__row2">
            <Sel label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} options={TIPOS} testid="tas-tipo" />
            <Sel label="Zona" value={f.zona} onChange={(v) => set('zona', v)} options={ZONAS} testid="tas-zona" />
          </div>
          <div className="tas__row2">
            {!esDepto && <label className="tas-field"><span>Superficie lote (m²)</span>
              <input type="number" value={f.lote} onChange={(e) => set('lote', e.target.value)} data-testid="tas-lote" /></label>}
            {f.tipo !== 'lote' && <label className="tas-field"><span>{esDepto ? 'Superficie cubierta (m²)' : 'Construido (m²)'}</span>
              <input type="number" value={f.cubiertos} onChange={(e) => set('cubiertos', e.target.value)} data-testid="tas-cubiertos" /></label>}
          </div>

          {f.tipo !== 'lote' && (
            <div className="tas__row2">
              <label className="tas-field"><span>Semicubierto (m²)</span>
                <input type="number" value={f.semicubiertos} onChange={(e) => set('semicubiertos', e.target.value)} data-testid="tas-semicubiertos" /></label>
              <label className="tas-field"><span>Dormitorios</span>
                <input type="number" value={f.dormitorios} onChange={(e) => set('dormitorios', e.target.value)} data-testid="tas-dormitorios" /></label>
              <label className="tas-field"><span>Baños</span>
                <input type="number" value={f.banos} onChange={(e) => set('banos', e.target.value)} data-testid="tas-banos" /></label>
            </div>
          )}

          {esCasa && (
            <div className="tas__row2">
              <Sel label="Calidad" value={f.calidad} onChange={(v) => set('calidad', v)} testid="tas-calidad"
                options={[['economica', 'Económica'], ['estandar', 'Estándar'], ['superior', 'Superior'], ['premium', 'Premium']]} />
              <Sel label="Estado" value={f.estado} onChange={(v) => set('estado', v)} testid="tas-estado"
                options={[['reciclar', 'A reciclar'], ['bueno', 'Bueno'], ['muybueno', 'Muy bueno'], ['excelente', 'Excelente']]} />
              <Sel label="Antigüedad" value={f.antiguedad} onChange={(v) => set('antiguedad', v)} testid="tas-antiguedad"
                options={[['estrenar', 'A estrenar'], ['hasta10', 'Hasta 10 años'], ['diez25', '10 a 25'], ['mas25', 'Más de 25']]} />
            </div>
          )}
          {esDepto && (
            <div className="tas__row2">
              <Sel label="Ambientes" value={f.ambientes} onChange={(v) => set('ambientes', v)} testid="tas-ambientes"
                options={[['1', '1 amb'], ['2', '2 amb'], ['3', '3 amb'], ['4', '4+ amb']]} />
              <Sel label="Vista" value={f.vista} onChange={(v) => set('vista', v)} testid="tas-vista"
                options={[['frente', 'Al frente'], ['lateral', 'Lateral'], ['contrafrente', 'Contrafrente']]} />
              <Sel label="Antigüedad" value={f.antDepto} onChange={(v) => set('antDepto', v)} testid="tas-antdepto"
                options={[['estrenar', 'A estrenar'], ['reciente', 'Reciente'], ['antiguo', 'Antiguo']]} />
            </div>
          )}

          {f.tipo !== 'lote' && (
            <>
              <h3 className="tas__section">Servicios y amenities</h3>
              <div className="tas__chks">
                <Chk label="Gas natural" checked={f.gas} onChange={(v) => set('gas', v)} testid="tas-gas" />
                <Chk label="Cloacas" checked={f.cloacas} onChange={(v) => set('cloacas', v)} testid="tas-cloacas" />
                <Chk label="Pileta" checked={f.pileta} onChange={(v) => set('pileta', v)} testid="tas-pileta" />
                <Chk label="Quincho" checked={f.quincho} onChange={(v) => set('quincho', v)} testid="tas-quincho" />
                <Chk label="Deck" checked={f.deck} onChange={(v) => set('deck', v)} testid="tas-deck" />
                <Chk label="Estac. cubierto" checked={f.estacCub} onChange={(v) => set('estacCub', v)} testid="tas-estaccub" />
                <Chk label="Estac. descubierto" checked={f.estacDesc} onChange={(v) => set('estacDesc', v)} testid="tas-estacdesc" />
                <Chk label="Galería" checked={f.galeria} onChange={(v) => set('galeria', v)} testid="tas-galeria" />
              </div>
            </>
          )}

          <h3 className="tas__section">Datos del propietario</h3>
          <div className="tas__row2">
            <Input label="Nombre" value={f.propietario} onChange={(e) => set('propietario', e.target.value)} data-testid="tas-propietario" />
            <Input label="Dirección" value={f.direccion} onChange={(e) => set('direccion', e.target.value)} data-testid="tas-direccion" />
          </div>
          <div className="tas__row2">
            <Input label="Teléfono" value={f.telefono} onChange={(e) => set('telefono', e.target.value)} data-testid="tas-telefono" />
            <Input label="Email" value={f.email} onChange={(e) => set('email', e.target.value)} data-testid="tas-email" />
          </div>

          <Button variant="primary" size="md" onClick={calcular} disabled={loading} data-testid="tas-calcular" className="tas__calc">
            <Calculator size={16} /> {loading ? 'Calculando…' : 'Calcular tasación'}
          </Button>
        </section>

        <aside className="tas__result" data-testid="tas-result">
          {!result ? (
            <div className="tas__empty"><Sparkles size={26} /><p>Completá los datos y calculá para ver la tasación.</p></div>
          ) : (
            <>
              <p className="tas__result-head">{result.tipoNombre} · {result.zonaNombre}</p>
              <div className="tas__price tas__price--varela">
                <span>PRECIO VARELA · RECOMENDADO</span>
                <strong data-testid="tas-varela-range">{usd(result.cierreMin)} – {usd(result.cierreMax)}</strong>
                <em>Coeficiente de cierre {Math.round(result.coef * 100)}%</em>
              </div>
              <div className="tas__price tas__price--ref">
                <span>PROMEDIO DE PORTALES · REFERENCIA</span>
                <strong>{usd(result.pubMin)} – {usd(result.pubMax)}</strong>
              </div>
              <div className="tas__actions">
                <Button variant="secondary" size="md" onClick={generarJpg} data-testid="tas-jpg"><Download size={15} /> Generar JPG</Button>
                <Button variant="ghost" size="md" onClick={guardarLead} data-testid="tas-lead"><UserPlus size={15} /> Guardar lead</Button>
              </div>
            </>
          )}
          {flash && <p className="tas__flash" data-testid="tas-flash">{flash}</p>}
        </aside>
      </div>
    </div>
  );
};

export default TasacionesScreen;
