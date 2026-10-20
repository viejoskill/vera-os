import { useEffect, useState } from 'react';
import { UserCog, X, Save } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, type Reservation } from './api';

interface Draft {
  form: { nombre: string; telefono: string; email: string; dni: string; domicilio: string; localidad: string; huespedes: number; comentario: string };
  deposito: string; limpieza: string; monto: string;
}

const draftKey = (rid: string) => `vera_rt_edit_draft_${rid}`;
const readDraft = (rid: string): Draft | null => {
  try { return JSON.parse(localStorage.getItem(draftKey(rid)) || 'null'); } catch { return null; }
};
const clearDraft = (rid: string) => { try { localStorage.removeItem(draftKey(rid)); } catch { /* noop */ } };

/** Modal para completar/corregir a mano los datos del huésped (frecuente en pre-reservas incompletas).
 * Autoguarda un borrador en localStorage mientras se edita: si cambiás de pestaña/ventana o la app se
 * recarga antes de guardar, al volver a abrir esta reserva el formulario recupera lo que venías escribiendo. */
export const EditarHuesped = ({ reserva, onDone, onClose }: {
  reserva: Reservation; onDone: (r: Reservation) => void; onClose: () => void;
}) => {
  const h = reserva.huesped || {};
  const draft = readDraft(reserva.id);
  const [form, setForm] = useState(draft?.form ?? {
    nombre: h.nombre || '', telefono: h.telefono || '', email: h.email || '', dni: h.dni || '',
    domicilio: h.domicilio || '', localidad: h.localidad || '',
    huespedes: h.huespedes || 1, comentario: h.comentario || '',
  });
  const [deposito, setDeposito] = useState(draft?.deposito ?? (reserva.depositoOverride != null ? String(reserva.depositoOverride) : ''));
  const [limpieza, setLimpieza] = useState(draft?.limpieza ?? (reserva.limpiezaOverride != null ? String(reserva.limpiezaOverride) : ''));
  const [monto, setMonto] = useState(draft?.monto ?? String(reserva.montoEstimado ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Borrador: se guarda en cada cambio, así nada se pierde si se cambia de ventana sin guardar.
  useEffect(() => {
    const d: Draft = { form, deposito, limpieza, monto };
    try { localStorage.setItem(draftKey(reserva.id), JSON.stringify(d)); } catch { /* noop */ }
  }, [reserva.id, form, deposito, limpieza, monto]);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    const montoNum = Number(monto);
    if (!monto || !(montoNum > 0)) { setError('El importe total tiene que ser mayor a 0.'); return; }
    setSaving(true); setError('');
    try {
      await api.updateHuesped(reserva.id, { ...form, huespedes: Number(form.huespedes) || 1 });
      await api.updateDeposito(reserva.id, deposito === '' ? null : Number(deposito));
      let actualizada = await api.updateLimpieza(reserva.id, limpieza === '' ? null : Number(limpieza));
      if (montoNum !== reserva.montoEstimado) {
        actualizada = await api.updateMonto(reserva.id, montoNum);
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
        {draft && <p className="rt-modal__draftnotice" data-testid={`rt-edit-draft-restored-${reserva.id}`}>Recuperamos lo que estabas editando antes de cambiar de ventana.</p>}

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

        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={guardar} disabled={saving} data-testid={`rt-edit-huesped-save-${reserva.id}`}>
            <Save size={16} /> {saving ? 'Guardando…' : 'Guardar datos'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditarHuesped;
