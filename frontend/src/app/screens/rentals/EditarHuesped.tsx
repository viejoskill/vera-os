import { useState } from 'react';
import { UserCog, X, Save } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, type Reservation } from './api';

/** Modal para completar/corregir a mano los datos del huésped (frecuente en pre-reservas incompletas). */
export const EditarHuesped = ({ reserva, onDone, onClose }: {
  reserva: Reservation; onDone: (r: Reservation) => void; onClose: () => void;
}) => {
  const h = reserva.huesped || {};
  const [form, setForm] = useState({
    nombre: h.nombre || '', telefono: h.telefono || '', email: h.email || '', dni: h.dni || '',
    domicilio: h.domicilio || '', localidad: h.localidad || '',
    huespedes: h.huespedes || 1, comentario: h.comentario || '',
  });
  const [deposito, setDeposito] = useState(reserva.depositoOverride != null ? String(reserva.depositoOverride) : '');
  const [limpieza, setLimpieza] = useState(reserva.limpiezaOverride != null ? String(reserva.limpiezaOverride) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    setSaving(true); setError('');
    try {
      await api.updateHuesped(reserva.id, { ...form, huespedes: Number(form.huespedes) || 1 });
      await api.updateDeposito(reserva.id, deposito === '' ? null : Number(deposito));
      const actualizada = await api.updateLimpieza(reserva.id, limpieza === '' ? null : Number(limpieza));
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
