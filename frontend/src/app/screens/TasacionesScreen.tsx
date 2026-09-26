import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Download, UserPlus, Sparkles, Share2, Check, Inbox, MessageCircle, MapPin, RefreshCw, FileSignature } from 'lucide-react';
import { Input, Button } from '@vera/ui';
import { env } from '@vera/config';
import { propertyService } from '@vera/services';
import type { PropertyType } from '@vera/types';
import { useAuthUser } from '@app/auth/useAuthUser';
import { TasadorConfig } from '@app/screens/TasadorConfig';
import { ZONAS_TASADOR } from '@app/public/MapaZonas';

const API = `${env.backendUrl}/api/tasacion`;

const ZONAS = ZONAS_TASADOR;
const TIPOS = [['casa', 'Casa'], ['duplex', 'Duplex'], ['lote', 'Lote / Terreno'], ['depto', 'Departamento']];

interface Result {
  pubMin: number; pubMax: number; cierreMin: number; cierreMax: number;
  coef: number; tipoNombre: string; zonaNombre: string;
}

interface OnlineLead {
  id: string; personId: string; nombre: string; telefono: string; email: string;
  tipo: string; zona: string; estMin: number; estMax: number; area: number; fecha: string;
}

interface ManualTasacion {
  id: string; createdAt: string; propietario: string; direccion: string; telefono: string; email: string;
  tipo: string; zona: string; zonaNombre: string; tipoNombre: string;
  lote: number | null; cubiertos: number | null; dormitorios: number | null; banos: number | null;
  cierreMin: number; cierreMax: number; asesor: string;
}

const usd = (n: number) => 'USD ' + n.toLocaleString('de-DE');

const TIPO_A_PROPERTY_TYPE: Record<string, PropertyType> = {
  casa: 'casa', duplex: 'casa', lote: 'terreno', depto: 'departamento',
};

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
  const navigate = useNavigate();
  const { displayName } = useAuthUser();
  const [f, setF] = useState({
    tipo: 'casa', zona: 'playa', cubiertos: '', semicubiertos: '', lote: '',
    dormitorios: '', banos: '',
    calidad: 'estandar', estado: 'bueno', antiguedad: 'hasta10',
    ambientes: '2', vista: 'frente', antDepto: 'reciente',
    gas: false, cloacas: false, pileta: false, quincho: false, deck: false,
    estacCub: false, estacDesc: false, galeria: false, cercaniaMar: false,
    propietario: '', direccion: '', telefono: '', email: '',
  });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');
  const [copied, setCopied] = useState(false);
  const [leads, setLeads] = useState<OnlineLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const loadLeads = () => {
    setLoadingLeads(true);
    fetch(`${API}/online-leads`).then((r) => r.json()).then((d) => setLeads(d.leads || [])).catch(() => setLeads([])).finally(() => setLoadingLeads(false));
  };
  const [manuales, setManuales] = useState<ManualTasacion[]>([]);
  const [loadingManuales, setLoadingManuales] = useState(true);
  const loadManuales = () => {
    setLoadingManuales(true);
    fetch(`${API}/manuales`).then((r) => r.json()).then((d) => setManuales(d.items || [])).catch(() => setManuales([])).finally(() => setLoadingManuales(false));
  };
  useEffect(() => { loadLeads(); loadManuales(); }, []);
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
    loadManuales();
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
    loadManuales();
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

  const [generandoAutorizacion, setGenerandoAutorizacion] = useState(false);
  const [generandoLeadId, setGenerandoLeadId] = useState<string | null>(null);
  const [generandoManualId, setGenerandoManualId] = useState<string | null>(null);

  const resolverPersona = async (fullName: string, phone: string, email?: string) => {
    const res = await fetch(`${env.backendUrl}/api/people/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phone, whatsapp: phone, email: email || undefined, role: 'propietario' }),
    });
    if (!res.ok) throw new Error('resolve failed');
    return res.json();
  };

  const crearPropiedadYAbrirWizard = async (payloadProp: Record<string, unknown>, personId?: string) => {
    const property = await propertyService.createProperty(payloadProp);
    navigate('/documentos/nuevo', {
      state: { prefillPropertyId: property.id, prefillPersonId: personId, prefillPersonRole: 'propietario' },
    });
  };

  const generarAutorizacion = async () => {
    if (!f.propietario || !f.telefono) { setFlash('Cargá nombre y teléfono del propietario para generar la autorización.'); setTimeout(() => setFlash(''), 3500); return; }
    if (!result) return;
    setGenerandoAutorizacion(true);
    try {
      const person = await resolverPersona(f.propietario, f.telefono, f.email);
      await crearPropiedadYAbrirWizard({
        title: f.direccion.trim() || `${result.tipoNombre} en ${result.zonaNombre}`,
        address: f.direccion.trim(),
        city: 'Costa del Este',
        type: TIPO_A_PROPERTY_TYPE[f.tipo] ?? 'terreno',
        areaM2: f.cubiertos ? Number(f.cubiertos) : (f.lote ? Number(f.lote) : 0),
        lotAreaM2: f.lote ? Number(f.lote) : undefined,
        bedrooms: f.dormitorios ? Number(f.dormitorios) : 0,
        bathrooms: f.banos ? Number(f.banos) : 0,
        price: Math.round(result.cierreMin) || 0,
        ownerId: person.id,
      }, person.id);
    } catch {
      setFlash('No pudimos generar la autorización. Probá de nuevo.');
      setTimeout(() => setFlash(''), 3500);
    } finally {
      setGenerandoAutorizacion(false);
    }
  };

  const generarAutorizacionLead = async (l: OnlineLead) => {
    setGenerandoLeadId(l.id);
    try {
      await crearPropiedadYAbrirWizard({
        title: `${l.tipo || 'Propiedad'} en ${l.zona || 'Costa del Este'}`,
        city: 'Costa del Este',
        type: TIPO_A_PROPERTY_TYPE[l.tipo] ?? 'terreno',
        areaM2: l.area || 0,
        price: Math.round(l.estMin) || 0,
        ownerId: l.personId,
      }, l.personId);
    } catch {
      setFlash('No pudimos generar la autorización de este lead. Probá de nuevo.');
      setTimeout(() => setFlash(''), 3500);
    } finally {
      setGenerandoLeadId(null);
    }
  };

  const generarAutorizacionManual = async (m: ManualTasacion) => {
    setGenerandoManualId(m.id);
    try {
      let personId: string | undefined;
      if (m.propietario && m.telefono) {
        const person = await resolverPersona(m.propietario, m.telefono, m.email || undefined);
        personId = person.id;
      }
      await crearPropiedadYAbrirWizard({
        title: (m.direccion || '').trim() || `${m.tipoNombre} en ${m.zonaNombre}`,
        address: (m.direccion || '').trim(),
        city: 'Costa del Este',
        type: TIPO_A_PROPERTY_TYPE[m.tipo] ?? 'terreno',
        areaM2: m.cubiertos || m.lote || 0,
        lotAreaM2: m.lote || undefined,
        bedrooms: m.dormitorios || 0,
        bathrooms: m.banos || 0,
        price: Math.round(m.cierreMin) || 0,
        ownerId: personId,
      }, personId);
    } catch {
      setFlash('No pudimos generar la autorización de esta tasación. Probá de nuevo.');
      setTimeout(() => setFlash(''), 3500);
    } finally {
      setGenerandoManualId(null);
    }
  };

  const eliminarManual = async (id: string) => {
    const prev = manuales;
    setManuales((cur) => cur.filter((m) => m.id !== id));
    try {
      const res = await fetch(`${API}/manuales/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      setManuales(prev);
      setFlash('No pudimos eliminarla. Probá de nuevo.');
      setTimeout(() => setFlash(''), 3000);
    }
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
          <a href={`${publicUrl}?sim=1`} target="_blank" rel="noreferrer" data-testid="tas-open-simulator" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: 'rgba(246,230,58,0.12)', color: '#e9e4b0', border: '1px solid rgba(246,230,58,0.35)', textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            🧪 Abrir simulador
          </a>
        </div>
      </header>

      <section className="tas__inbox" data-testid="tasaciones-inbox" style={{ background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Inbox size={17} /> Tasaciones recibidas</h3>
          <span style={{ fontSize: 12, color: '#9a9a95' }}>({leads.length})</span>
          <button type="button" onClick={loadLeads} title="Actualizar" data-testid="tas-inbox-refresh" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#c9c9c4', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}><RefreshCw size={13} /> Actualizar</button>
        </div>
        <p style={{ margin: '0 0 12px', color: '#9a9a95', fontSize: 12.5 }}>Contactos que tasaron su propiedad desde la web pública. Quedan etiquetados como <strong style={{ color: '#c9c9c4' }}>Tasación</strong> en Personas.</p>
        {loadingLeads ? (
          <p style={{ color: '#9a9a95', fontSize: 13 }}>Cargando…</p>
        ) : leads.length === 0 ? (
          <p style={{ color: '#6b6b66', fontSize: 13 }}>Todavía no hay tasaciones online. Compartí el link público para empezar a recibirlas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leads.map((l) => {
              const tel = (l.telefono || '').replace(/\D/g, '');
              return (
                <div key={l.id} data-testid={`tas-lead-${l.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{l.nombre}{l.telefono ? <span style={{ color: '#9a9a95', fontWeight: 400 }}> · {l.telefono}</span> : null}</div>
                    <div style={{ color: '#9a9a95', fontSize: 12.5, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ textTransform: 'capitalize' }}>{l.tipo}</span>
                      <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {l.zona}</span>
                      {(l.estMin || l.estMax) ? <span style={{ color: '#8fe3c4' }}>{usd(l.estMin)} – {usd(l.estMax)}</span> : null}
                      {l.fecha ? <span>{new Date(l.fecha).toLocaleDateString('es-AR')}</span> : null}
                    </div>
                  </div>
                  {tel && (
                    <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" data-testid={`tas-lead-wa-${l.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: 'rgba(37,211,102,0.12)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)', textDecoration: 'none', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}><MessageCircle size={14} /> WhatsApp</a>
                  )}
                  <button
                    type="button" onClick={() => generarAutorizacionLead(l)} disabled={generandoLeadId === l.id}
                    data-testid={`tas-lead-autorizacion-${l.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: 'rgba(246,230,58,0.12)', color: '#e9e4b0', border: '1px solid rgba(246,230,58,0.35)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    <FileSignature size={14} /> {generandoLeadId === l.id ? 'Generando…' : 'Generar autorización'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="tas__inbox" data-testid="tasaciones-manuales" style={{ background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={17} /> Tasaciones realizadas</h3>
          <span style={{ fontSize: 12, color: '#9a9a95' }}>({manuales.length})</span>
          <button type="button" onClick={loadManuales} title="Actualizar" data-testid="tas-manuales-refresh" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#c9c9c4', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}><RefreshCw size={13} /> Actualizar</button>
        </div>
        <p style={{ margin: '0 0 12px', color: '#9a9a95', fontSize: 12.5 }}>Toda tasación manual con propietario o dirección se guarda sola acá, aunque solo hayas generado el JPG.</p>
        {loadingManuales ? (
          <p style={{ color: '#9a9a95', fontSize: 13 }}>Cargando…</p>
        ) : manuales.length === 0 ? (
          <p style={{ color: '#6b6b66', fontSize: 13 }}>Todavía no hay tasaciones manuales guardadas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {manuales.map((m) => (
              <div key={m.id} data-testid={`tas-manual-row-${m.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                    {m.direccion || m.propietario || 'Sin nombre'}
                    {m.propietario && m.direccion ? <span style={{ color: '#9a9a95', fontWeight: 400 }}> · {m.propietario}</span> : null}
                    {m.telefono ? <span style={{ color: '#9a9a95', fontWeight: 400 }}> · {m.telefono}</span> : null}
                  </div>
                  <div style={{ color: '#9a9a95', fontSize: 12.5, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{m.tipoNombre}</span>
                    <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {m.zonaNombre}</span>
                    {(m.cierreMin || m.cierreMax) ? <span style={{ color: '#8fe3c4' }}>{usd(m.cierreMin)} – {usd(m.cierreMax)}</span> : null}
                    {m.createdAt ? <span>{new Date(m.createdAt).toLocaleDateString('es-AR')}</span> : null}
                  </div>
                </div>
                <button
                  type="button" onClick={() => generarAutorizacionManual(m)} disabled={generandoManualId === m.id}
                  data-testid={`tas-manual-autorizacion-${m.id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: 'rgba(246,230,58,0.12)', color: '#e9e4b0', border: '1px solid rgba(246,230,58,0.35)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  <FileSignature size={14} /> {generandoManualId === m.id ? 'Generando…' : 'Generar autorización'}
                </button>
                <button
                  type="button" onClick={() => eliminarManual(m.id)} title="Eliminar" data-testid={`tas-manual-eliminar-${m.id}`}
                  style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9a9a95', borderRadius: 9, padding: '7px 9px', cursor: 'pointer', fontSize: 12.5 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

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
          <Chk label="A menos de 200m del mar" checked={f.cercaniaMar} onChange={(v) => set('cercaniaMar', v)} testid="tas-cercania-mar" />

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
                options={[['economica', 'Económica'], ['estandar', 'Estándar'], ['estandar_plus', 'Estándar Plus'], ['superior', 'Superior'], ['premium', 'Premium']]} />
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
                <Button variant="ghost" size="md" onClick={generarAutorizacion} disabled={generandoAutorizacion} data-testid="tas-autorizacion">
                  <FileSignature size={15} /> {generandoAutorizacion ? 'Generando…' : 'Generar autorización'}
                </Button>
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
