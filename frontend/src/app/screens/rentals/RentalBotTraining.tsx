import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, Save, Sparkles, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { env } from '@vera/config';
import { ConnectWhatsApp } from './ConnectWhatsApp';

const API = `${env.backendUrl}/api/rentals/bot`;

interface Regla { id: string; texto: string; activa: boolean }
interface Contacto { id: string; nombre: string; telefono: string; rol: string; nota?: string }
interface Faq { q: string; a: string }
interface Cfg {
  nombre: string; saludo: string; tono: string; estilo: string;
  alquileresActivo: boolean; ventasActivo: boolean;
  derivaAlquileres: string; derivaVentas: string; datosFijos: string; reglas: Regla[];
  digestEmail: string; digestEnabled: boolean;
}

const box: React.CSSProperties = { background: '#141412', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 16 };
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, background: '#1a1a18', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 12, color: '#9a9a95', display: 'block', marginBottom: 6, marginTop: 12 };
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 };

export const RentalBotTraining = () => {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [faq, setFaq] = useState<Faq[]>([]);
  const [nc, setNc] = useState({ nombre: '', telefono: '', rol: 'propietario', nota: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const load = async () => {
    const d = await fetch(`${API}/config`).then((r) => r.json());
    setCfg({ ...d.config, reglas: d.config.reglas || [] });
    setContactos(d.contactos || []);
    setFaq(d.faq || []);
  };
  useEffect(() => { load(); }, []);

  const set = (k: keyof Cfg, v: unknown) => setCfg((c) => (c ? { ...c, [k]: v } as Cfg : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true); setMsg('');
    try {
      await fetch(`${API}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      await fetch(`${API}/faq`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: faq }) });
      setMsg('✅ Guardado. Probalo en el simulador.');
    } catch { setMsg('⚠️ No se pudo guardar.'); }
    finally { setSaving(false); }
  };

  const seed = async () => { await fetch(`${API}/rules/seed`, { method: 'POST' }); await load(); };

  const sendTestEmail = async () => {
    if (!cfg) return;
    setSendingEmail(true); setEmailMsg('');
    try {
      // Guardamos primero para que el backend use el email actual.
      await fetch(`${API}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      const r = await fetch(`${API}/digest/email`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || 'No se pudo enviar');
      setEmailMsg(`✅ Email de prueba enviado a ${j.sentTo}. Revisá tu casilla (y spam).`);
    } catch (e: any) { setEmailMsg(`⚠️ ${e.message || 'No se pudo enviar el email.'}`); }
    finally { setSendingEmail(false); }
  };
  const addContacto = async () => {
    if (!nc.nombre.trim() || !nc.telefono.trim()) return;
    const c = await fetch(`${API}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nc) }).then((r) => r.json());
    setContactos((cs) => [...cs, c]); setNc({ nombre: '', telefono: '', rol: 'propietario', nota: '' });
  };
  const delContacto = async (id: string) => { await fetch(`${API}/contacts/${id}`, { method: 'DELETE' }); setContactos((cs) => cs.filter((c) => c.id !== id)); };

  if (!cfg) return <div style={{ color: '#9a9a95', padding: 20 }}>Cargando…</div>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 60px' }} data-testid="bot-training">
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(143,227,196,0.14)', color: '#8fe3c4', border: '1px solid rgba(143,227,196,0.3)' }}><Bot size={20} /></div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>Entrenar a Vera</h1>
          <p style={{ margin: '2px 0 0', color: '#9a9a95', fontSize: 13 }}>Tono, reglas, datos y contactos. Vera ya usa tus precios y disponibilidad reales.</p>
        </div>
        <button onClick={() => navigate('/bot-alquileres')} data-testid="go-simulator" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#c9c9c4', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 13 }}><MessageSquareText size={14} /> Simulador</button>
      </header>

      <ConnectWhatsApp />

      {/* Resumen por email */}
      <section style={box} data-testid="digest-email-section">
        <h2 style={h2}>📧 Resumen automático por email</h2>
        <p style={{ color: '#9a9a95', fontSize: 12, margin: '0 0 8px' }}>
          Vera te manda 2 veces por día (9:30 y 16:30) un resumen de los chats pendientes con el semáforo de urgencia 🔴🟡🟢.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#eee', fontSize: 14, marginBottom: 4 }}>
          <input type="checkbox" checked={!!cfg.digestEnabled} onChange={(e) => set('digestEnabled', e.target.checked)} data-testid="cfg-digest-enabled" /> Activar envío automático
        </label>
        <label style={lbl}>Email donde recibir el resumen</label>
        <input
          style={inp}
          type="email"
          placeholder="tucorreo@ejemplo.com"
          value={cfg.digestEmail || ''}
          onChange={(e) => set('digestEmail', e.target.value)}
          data-testid="cfg-digest-email"
        />
        <p style={{ color: '#77776f', fontSize: 11.5, margin: '6px 0 10px' }}>
          Tip: al principio el correo solo llega a la casilla con la que te registraste en Resend. Para usar otra, verificá tu dominio.
        </p>
        <button
          type="button"
          onClick={sendTestEmail}
          disabled={sendingEmail}
          data-testid="send-test-email"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, background: 'rgba(143,227,196,0.12)', color: '#8fe3c4', border: '1px solid rgba(143,227,196,0.3)', fontWeight: 600, fontSize: 13, cursor: sendingEmail ? 'default' : 'pointer', opacity: sendingEmail ? 0.6 : 1 }}
        >
          {sendingEmail ? 'Enviando…' : 'Enviar email de prueba'}
        </button>
        {emailMsg && <p data-testid="digest-email-msg" style={{ color: emailMsg.startsWith('✅') ? '#8fe3c4' : '#e05a5a', fontSize: 12.5, marginTop: 10 }}>{emailMsg}</p>}
      </section>

      {/* Identidad & tono */}
      <section style={box}>
        <h2 style={h2}>Identidad &amp; tono</h2>
        <label style={lbl}>Nombre del asistente</label>
        <input style={inp} value={cfg.nombre} onChange={(e) => set('nombre', e.target.value)} data-testid="cfg-nombre" />
        <label style={lbl}>Saludo de presentación</label>
        <input style={inp} value={cfg.saludo} onChange={(e) => set('saludo', e.target.value)} data-testid="cfg-saludo" />
        <label style={lbl}>Tono / personalidad</label>
        <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={cfg.tono} onChange={(e) => set('tono', e.target.value)} data-testid="cfg-tono" />
      </section>

      {/* Ventas & alquileres */}
      <section style={box}>
        <h2 style={h2}>Ventas &amp; Alquileres</h2>
        <p style={{ color: '#9a9a95', fontSize: 12, margin: '0 0 8px' }}>Este número atiende:</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#eee', fontSize: 14, marginBottom: 8 }}>
          <input type="checkbox" checked={cfg.alquileresActivo} onChange={(e) => set('alquileresActivo', e.target.checked)} data-testid="cfg-alquileres" /> Alquileres temporarios
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#eee', fontSize: 14 }}>
          <input type="checkbox" checked={cfg.ventasActivo} onChange={(e) => set('ventasActivo', e.target.checked)} data-testid="cfg-ventas" /> Ventas (pre-atiende y deriva)
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Deriva alquileres/administración a</label>
            <input style={inp} value={cfg.derivaAlquileres} onChange={(e) => set('derivaAlquileres', e.target.value)} data-testid="cfg-deriva-alq" /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Deriva ventas/tasaciones a</label>
            <input style={inp} value={cfg.derivaVentas} onChange={(e) => set('derivaVentas', e.target.value)} data-testid="cfg-deriva-ven" /></div>
        </div>
      </section>

      {/* Reglas */}
      <section style={box}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ ...h2, flex: 1 }}>Reglas</h2>
          <button onClick={seed} data-testid="seed-rules" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9, background: 'rgba(246,230,58,0.12)', color: '#F6E63A', border: '1px solid rgba(246,230,58,0.3)', cursor: 'pointer', fontSize: 12 }}><Sparkles size={13} /> Cargar sugeridas</button>
        </div>
        <p style={{ color: '#9a9a95', fontSize: 12, margin: '2px 0 10px' }}>Escribí reglas en lenguaje natural. Desactivá las que no quieras sin borrarlas.</p>
        {cfg.reglas.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <input type="checkbox" checked={r.activa} onChange={(e) => { const rr = [...cfg.reglas]; rr[i] = { ...r, activa: e.target.checked }; set('reglas', rr); }} style={{ marginTop: 11 }} data-testid={`regla-toggle-${i}`} />
            <textarea style={{ ...inp, minHeight: 38, resize: 'vertical', opacity: r.activa ? 1 : 0.5 }} value={r.texto} onChange={(e) => { const rr = [...cfg.reglas]; rr[i] = { ...r, texto: e.target.value }; set('reglas', rr); }} data-testid={`regla-text-${i}`} />
            <button onClick={() => set('reglas', cfg.reglas.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#e07a7a', cursor: 'pointer', padding: 8 }} data-testid={`regla-del-${i}`}><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => set('reglas', [...cfg.reglas, { id: Math.random().toString(36).slice(2, 8), texto: '', activa: true }])} data-testid="regla-add" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', color: '#c9c9c4', border: '1px dashed rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 13, marginTop: 4 }}><Plus size={14} /> Agregar regla</button>
      </section>

      {/* Datos fijos */}
      <section style={box}>
        <h2 style={h2}>Datos fijos</h2>
        <p style={{ color: '#9a9a95', fontSize: 12, margin: '2px 0 8px' }}>Teléfonos, horarios de oficina, formas de pago, links, políticas. Todo lo que no cambia seguido.</p>
        <textarea style={{ ...inp, minHeight: 110, resize: 'vertical' }} value={cfg.datosFijos} onChange={(e) => set('datosFijos', e.target.value)} placeholder={'Ej:\n- Oficina: Av. 3 nº 1218, Costa del Este. Lun a Sáb 9:30 a 17:00.\n- Pagos: transferencia o efectivo. Seña 30%.\n- Web: www.varelapropiedadescde.com.ar'} data-testid="cfg-datos" />
      </section>

      {/* Contactos conocidos */}
      <section style={box}>
        <h2 style={h2}>Contactos conocidos</h2>
        <p style={{ color: '#9a9a95', fontSize: 12, margin: '2px 0 10px' }}>Propietarios, limpieza y técnicos. A ellos Vera NO les ofrece propiedades: atiende directo y deriva.</p>
        {contactos.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#1a1a18', borderRadius: 10, marginBottom: 6 }} data-testid={`contacto-${c.id}`}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#8fe3c4', textTransform: 'uppercase' }}>{c.rol}</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{c.nombre}</span>
            <span style={{ color: '#9a9a95', fontSize: 13 }}>{c.telefono}</span>
            {c.nota && <span style={{ color: '#77776f', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nota}</span>}
            <button onClick={() => delContacto(c.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e07a7a', cursor: 'pointer' }} data-testid={`contacto-del-${c.id}`}><Trash2 size={15} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <input style={{ ...inp, flex: '1 1 140px' }} placeholder="Nombre" value={nc.nombre} onChange={(e) => setNc({ ...nc, nombre: e.target.value })} data-testid="nc-nombre" />
          <input style={{ ...inp, flex: '1 1 140px' }} placeholder="Teléfono" value={nc.telefono} onChange={(e) => setNc({ ...nc, telefono: e.target.value })} data-testid="nc-telefono" />
          <select style={{ ...inp, flex: '0 0 150px' }} value={nc.rol} onChange={(e) => setNc({ ...nc, rol: e.target.value })} data-testid="nc-rol">
            <option value="propietario">Propietario</option>
            <option value="limpieza">Limpieza</option>
            <option value="tecnico">Servicio técnico</option>
            <option value="otro">Otro</option>
          </select>
          <input style={{ ...inp, flex: '1 1 100%' }} placeholder="Nota (opcional)" value={nc.nota} onChange={(e) => setNc({ ...nc, nota: e.target.value })} data-testid="nc-nota" />
          <button onClick={addContacto} data-testid="nc-add" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: '#8fe3c4', color: '#0f2a22', border: 'none', fontWeight: 700, cursor: 'pointer' }}><Plus size={15} /> Agregar contacto</button>
        </div>
      </section>

      {/* FAQ */}
      <section style={box}>
        <h2 style={h2}>Preguntas frecuentes</h2>
        {faq.map((f, i) => (
          <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Pregunta" value={f.q} onChange={(e) => { const ff = [...faq]; ff[i] = { ...f, q: e.target.value }; setFaq(ff); }} data-testid={`faq-q-${i}`} />
              <button onClick={() => setFaq(faq.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#e07a7a', cursor: 'pointer', padding: 8 }} data-testid={`faq-del-${i}`}><Trash2 size={15} /></button>
            </div>
            <textarea style={{ ...inp, minHeight: 44, resize: 'vertical', marginTop: 6 }} placeholder="Respuesta" value={f.a} onChange={(e) => { const ff = [...faq]; ff[i] = { ...f, a: e.target.value }; setFaq(ff); }} data-testid={`faq-a-${i}`} />
          </div>
        ))}
        <button onClick={() => setFaq([...faq, { q: '', a: '' }])} data-testid="faq-add" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', color: '#c9c9c4', border: '1px dashed rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 13 }}><Plus size={14} /> Agregar pregunta</button>
      </section>

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', background: 'linear-gradient(to top, #0d0d0c 60%, transparent)' }}>
        <button onClick={save} disabled={saving} data-testid="save-training" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, background: '#F6E63A', color: '#1c1c1c', border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}><Save size={17} /> {saving ? 'Guardando…' : 'Guardar entrenamiento'}</button>
        {msg && <span style={{ color: msg.startsWith('✅') ? '#8fe3c4' : '#e07a7a', fontSize: 14 }} data-testid="save-msg">{msg}</span>}
      </div>
    </div>
  );
};

export default RentalBotTraining;
