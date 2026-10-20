import { useEffect, useState } from 'react';
import { UserCog, X, Save, History } from 'lucide-react';
import { Button } from '@vera/ui';
import { useAuth } from '@app/auth/AuthProvider';
import { api, type Reservation } from './api';

type EditValues = {
  form: { nombre: string; telefono: string; email: string; dni: string; domicilio: string; localidad: string; huespedes: number; comentario: string };
  deposito: string; limpieza: string; monto: string;
};
interface Draft { baseline: EditValues; edited: EditValues; }

const draftKey = (rid: string) => `vera_rt_edit_draft_${rid}`;
const readDraft = (rid: string): Draft | null => {
  try { return JSON.parse(localStorage.getItem(draftKey(rid)) || 'null'); } catch { return null; }
};
const clearDraft = (rid: string) => { try { localStorage.removeItem(draftKey(rid)); } catch { /* noop */ } };
const sameValues = (a: EditValues, b: EditValues) => JSON.stringify(a) === JSON.stringify(b);

const originalsOf = (reserva: Reservation): EditValues => {
  const h = reserva.huesped || {};
  return {
    form: {
      nombre: h.nombre || '', telefono: h.telefono || '', email: h.email || '', dni: h.dni || '',
      domicilio: h.domicilio || '', localidad: h.localidad || '',
      huespedes: h.huespedes || 1, comentario: h.comentario || '',
    },
    deposito: reserva.depositoOverride != null ? String(reserva.depositoOverride) : '',
    limpieza: reserva.limpiezaOverride != null ? String(reserva.limpiezaOverride) : '',
    monto: String(reserva.montoEstimado ?? ''),
  };
};

const fmtFecha = (iso: string) => {
  try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
};
const fmtValor = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

/** Modal para completar/corregir a mano los datos del huésped (frecuente en pre-reservas incompletas).
 * Al abrir, trae siempre la versión MÁS FRESCA de la reserva desde el backend (no confía en la
 * prop, que puede venir de una lista cacheada). Autoguarda un borrador en localStorage SOLO
 * mientras hay cambios reales sin guardar; se descarta si la reserva cambió por otro lado
 * mientras tanto o al guardar con éxito. Muestra el historial de quién cambió qué y cuándo. */
export const EditarHuesped = ({ reserva, onDone, onClose }: {
  reserva: Reservation; onDone: (r: Reservation) => void; onClose: () => void;
}) => {
  const [fresh, setFresh] = useState<Reservation | null>(null);
  useEffect(() => {
    let active = true;
    api.getReservation(reserva.id)
      .then((r) => { if (active) setFresh(r); })
      .catch(() => { if (active) setFresh(reserva); }); // si falla el fetch, seguimos con lo que ya teníamos
    return () => { active = false; };
  }, [reserva.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fresh) {
    return (
      <div className="rt-modal" data-testid={`rt-edit-huesped-modal-${reserva.id}`} onClick={onClose}>
        <div className="rt-modal__box" onClick={(e) => e.stopPropagation()}>
          <p className="rt-book__hint" data-testid={`rt-edit-huesped-loading-${reserva.id}`}>Cargando datos actuales de la reserva…</p>
        </div>
      </div>
    );
  }
  return <EditarHuespedForm reserva={fresh} onDone={onDone} onClose={onClose} />;
};

const EditarHuespedForm = ({ reserva, onDone, onClose }: {
  reserva: Reservation; onDone: (r: Reservation) => void; onClose: () => void;
}) => {
  const { session } = useAuth();
  const actorEmail = session?.user?.email;
  const [originals] = useState(() => originalsOf(reserva));
  // Se calcula UNA sola vez al montar (ya con datos frescos del backend): si hay un borrador y su
  // base coincide con los datos actuales de la reserva, se restaura; si no, se descarta.
  const [restored] = useState(() => {
    const d = readDraft(reserva.id);
    if (d && sameValues(d.baseline, originals)) return d.edited;
    if (d) clearDraft(reserva.id); // borrador viejo/ya no aplica
    return null;
  });
  const initial = restored ?? originals;
  const [form, setForm] = useState(initial.form);
  const [deposito, setDeposito] = useState(initial.deposito);
  const [limpieza, setLimpieza] = useState(initial.limpieza);
  const [monto, setMonto] = useState(initial.monto);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showHistorial, setShowHistorial] = useState(false);
  const historial = [...(reserva.historial || [])].reverse(); // más reciente primero

  // Borrador: solo se guarda si lo tipeado difiere de los datos originales (evita ruido y borradores
  // viejos pisando datos nuevos); si vuelve a coincidir con el original, se borra.
  useEffect(() => {
    const current: EditValues = { form, deposito, limpieza, monto };
    if (sameValues(current, originals)) { clearDraft(reserva.id); return; }
    try { localStorage.setItem(draftKey(reserva.id), JSON.stringify({ baseline: originals, edited: current })); } catch { /* noop */ }
  }, [reserva.id, originals, form, deposito, limpieza, monto]);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const cancelar = () => { clearDraft(reserva.id); onClose(); };

  const guardar = async () => {
    const montoNum = Number(monto);
    if (!monto || !(montoNum > 0)) { setError('El importe total tiene que ser mayor a 0.'); return; }
    setSaving(true); setError('');
    try {
      await api.updateHuesped(reserva.id, { ...form, huespedes: Number(form.huespedes) || 1 }, actorEmail);
      await api.updateDeposito(reserva.id, deposito === '' ? null : Number(deposito), actorEmail);
      let actualizada = await api.updateLimpieza(reserva.id, limpieza === '' ? null : Number(limpieza), actorEmail);
      if (montoNum !== reserva.montoEstimado) {
        actualizada = await api.updateMonto(reserva.id, montoNum, actorEmail);
      }
      clearDraft(reserva.id);
      onDone(actualizada);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="rt-modal" data-testid={`rt-edit-huesped-modal-${reserva.id}`} onClick={onClose}>
      <div className="rt-modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="rt-modal__head">
          <h3><UserCog size={18} /> Editar datos de la reserva</h3>
          <button type="button" onClick={onClose} data-testid={`rt-edit-huesped-close-${reserva.id}`}><X size={18} /></button>
        </div>
        <p className="rt-modal__sub">{reserva.propertyTitulo} · {reserva.checkIn} → {reserva.checkOut}</p>
        {restored && <p className="rt-modal__draftnotice" data-testid={`rt-edit-draft-restored-${reserva.id}`}>Recuperamos lo que estabas editando antes de cambiar de ventana.</p>}

        <div className="rt-row2">
          <label className="rt-field"><span>Nombre y apellido</span>
            <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} data-testid={`rt-edit-huesped-nombre-${reserva.id}`} /></label>
          <label className="rt-field"><span>Teléfono</span>
            <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} data-testid={`rt-edit-huesped-telefono-${reserva.id}`} /></label>
        </div>
        <div className="rt-row2">
          <label className="rt-field"><span>Email</span>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} data-testid={`rt-edit-huesped-email-${reserva.id}`} /></label>
          <label className="rt-field"><span>DNI</span>
            <input value={form.dni} onChange={(e) => set('dni', e.target.value)} data-testid={`rt-edit-huesped-dni-${reserva.id}`} /></label>
        </div>
        <div className="rt-row2">
          <label className="rt-field"><span>Domicilio</span>
            <input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} data-testid={`rt-edit-huesped-domicilio-${reserva.id}`} /></label>
          <label className="rt-field"><span>Localidad</span>
            <input value={form.localidad} onChange={(e) => set('localidad', e.target.value)} data-testid={`rt-edit-huesped-localidad-${reserva.id}`} /></label>
        </div>
        <label className="rt-field"><span>Cantidad de huéspedes</span>
          <input type="number" min={1} value={form.huespedes} onChange={(e) => set('huespedes', e.target.value)} data-testid={`rt-edit-huesped-huespedes-${reserva.id}`} /></label>
        <label className="rt-field"><span>Comentario</span>
          <textarea rows={2} value={form.comentario} onChange={(e) => set('comentario', e.target.value)} data-testid={`rt-edit-huesped-comentario-${reserva.id}`} /></label>
        <label className="rt-field"><span>Importe total de la reserva — ej. para ajustar el incremento del 5% por estadía menor a 7 noches</span>
          <input type="number" placeholder="Importe total" value={monto}
            onChange={(e) => setMonto(e.target.value)} data-testid={`rt-edit-monto-${reserva.id}`} /></label>
        <label className="rt-field"><span>Depósito de garantía — dejalo vacío para usar el de la propiedad</span>
          <input type="number" placeholder="Monto del depósito para ESTA reserva" value={deposito}
            onChange={(e) => setDeposito(e.target.value)} data-testid={`rt-edit-deposito-${reserva.id}`} /></label>
        <label className="rt-field"><span>Cargo de limpieza — dejalo vacío para usar el de la propiedad</span>
          <input type="number" placeholder="Monto de limpieza para ESTA reserva" value={limpieza}
            onChange={(e) => setLimpieza(e.target.value)} data-testid={`rt-edit-limpieza-${reserva.id}`} /></label>

        {error && <p className="rt-book__error" data-testid={`rt-edit-huesped-error-${reserva.id}`}>{error}</p>}

        <button type="button" className="rt-edit__historial-toggle"
          onClick={() => setShowHistorial((s) => !s)} data-testid={`rt-edit-historial-toggle-${reserva.id}`}>
          <History size={13} /> Historial de cambios {historial.length > 0 ? `(${historial.length})` : ''}
        </button>
        {showHistorial && (
          <div className="rt-edit__historial" data-testid={`rt-edit-historial-${reserva.id}`}>
            {historial.length === 0 ? (
              <p className="rt-book__hint">Todavía no se editó nada en esta reserva.</p>
            ) : historial.map((h, i) => (
              <div key={i} className="rt-edit__historial-row">
                <span className="rt-edit__historial-fecha">{fmtFecha(h.fecha)}</span>
                <span className="rt-edit__historial-texto">
                  <strong>{h.usuario}</strong> cambió <strong>{h.campo}</strong>: {fmtValor(h.anterior)} → {fmtValor(h.nuevo)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={cancelar} data-testid={`rt-edit-huesped-cancel-${reserva.id}`}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={guardar} disabled={saving} data-testid={`rt-edit-huesped-save-${reserva.id}`}>
            <Save size={16} /> {saving ? 'Guardando…' : 'Guardar datos'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditarHuesped;

