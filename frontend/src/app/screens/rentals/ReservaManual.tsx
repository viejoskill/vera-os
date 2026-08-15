import { useState, useEffect } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Button, Input } from '@vera/ui';
import { api, fmtMoney, nightsBetween, type RentalProperty } from './api';

/** Alta manual de una reserva ya confirmada (dueño reservó / huésped en el mostrador). */
export const ReservaManual = ({ property, onClose, onCreated }: {
  property: RentalProperty; onClose: () => void; onCreated: () => void;
}) => {
  const mon = property.moneda || 'ARS';
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [huespedes, setHuespedes] = useState('2');
  const [comentario, setComentario] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [totalTocado, setTotalTocado] = useState(false);
  const [senaTenedor, setSenaTenedor] = useState('nosotros');
  const [senaMonto, setSenaMonto] = useState('');
  const [senaMetodo, setSenaMetodo] = useState('efectivo');
  const [senaPagada, setSenaPagada] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const noches = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  // Sugerir el total automáticamente desde la tarifa de la propiedad (si el usuario no lo tocó).
  useEffect(() => {
    if (!checkIn || !checkOut || noches < 1 || totalTocado) return;
    let cancel = false;
    api.quote(property.slug, checkIn, checkOut)
      .then((q: { total?: number }) => { if (!cancel && q?.total != null) setMontoTotal(String(q.total)); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [checkIn, checkOut, noches, totalTocado, property.slug]);

  const total = Number(montoTotal) || 0;
  const sena = senaTenedor === 'ninguno' ? 0 : Number(senaMonto) || 0;
  const saldo = Math.max(0, total - sena);

  const guardar = async () => {
    if (!nombre.trim()) { setErr('Cargá el nombre del huésped.'); return; }
    if (!checkIn || !checkOut || noches < 1) { setErr('Revisá las fechas de ingreso y egreso.'); return; }
    if (total <= 0) { setErr('Ingresá el monto total de la reserva.'); return; }
    setErr(''); setSaving(true);
    try {
      await api.createManualReservation({
        propertyId: property.id, nombre, telefono, email, dni,
        huespedes: Number(huespedes) || 1, comentario, domicilio, localidad,
        checkIn, checkOut, montoTotal: total,
        senaMonto: sena, senaTenedor, senaMetodo, senaPagada,
        origen: 'Manual',
      });
      onCreated();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  return (
    <div className="rt-modal" data-testid="rt-manual-modal" onClick={onClose}>
      <div className="rt-modal__box" onClick={(e) => e.stopPropagation()}>
        <div className="rt-modal__head">
          <h3><UserPlus size={18} /> Nueva reserva manual</h3>
          <button type="button" onClick={onClose} data-testid="rt-manual-close"><X size={18} /></button>
        </div>
        <p className="rt-modal__sub">
          Para reservas que hiciste vos, que trajo el dueño, o un huésped que llega en el momento. Queda <strong>confirmada</strong> directamente.
        </p>

        <h4 className="rt-manual__sec">Huésped</h4>
        <div className="rt-row2">
          <Input label="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} data-testid="rt-manual-nombre" />
          <Input label="Teléfono / WhatsApp" value={telefono} onChange={(e) => setTelefono(e.target.value)} data-testid="rt-manual-telefono" />
        </div>
        <div className="rt-row3">
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="rt-manual-email" />
          <Input label="DNI" value={dni} onChange={(e) => setDni(e.target.value)} data-testid="rt-manual-dni" />
          <Input label="Huéspedes" type="number" value={huespedes} onChange={(e) => setHuespedes(e.target.value)} data-testid="rt-manual-huespedes" />
        </div>
        <div className="rt-row2">
          <Input label="Domicilio (para la reserva y el contrato)" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} data-testid="rt-manual-domicilio" />
          <Input label="Localidad del huésped" value={localidad} onChange={(e) => setLocalidad(e.target.value)} data-testid="rt-manual-localidad" />
        </div>

        <h4 className="rt-manual__sec">Estadía</h4>
        <div className="rt-row2">
          <label className="rt-field"><span>Ingreso (check-in)</span>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} data-testid="rt-manual-checkin" /></label>
          <label className="rt-field"><span>Egreso (check-out)</span>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} data-testid="rt-manual-checkout" /></label>
        </div>
        {noches > 0 && <p className="rt-hint">{noches} noche{noches > 1 ? 's' : ''}.</p>}
        <label className="rt-field"><span>Monto total de la reserva ({mon})</span>
          <input type="number" value={montoTotal} onChange={(e) => { setMontoTotal(e.target.value); setTotalTocado(true); }} placeholder="Ej.: 720000" data-testid="rt-manual-total" /></label>

        <h4 className="rt-manual__sec">Seña</h4>
        <div className="rt-row2">
          <label className="rt-field"><span>¿Quién tiene la seña?</span>
            <select value={senaTenedor} onChange={(e) => setSenaTenedor(e.target.value)} data-testid="rt-manual-tenedor">
              <option value="nosotros">La cobramos nosotros</option>
              <option value="dueno">La tiene el dueño</option>
              <option value="ninguno">Sin seña</option>
            </select></label>
          {senaTenedor !== 'ninguno' && (
            <label className="rt-field"><span>Monto de la seña ({mon})</span>
              <input type="number" value={senaMonto} onChange={(e) => setSenaMonto(e.target.value)} placeholder="Ej.: 216000" data-testid="rt-manual-sena-monto" /></label>
          )}
        </div>
        {senaTenedor === 'nosotros' && (
          <div className="rt-row2">
            <label className="rt-field"><span>Medio de pago</span>
              <select value={senaMetodo} onChange={(e) => setSenaMetodo(e.target.value)} data-testid="rt-manual-sena-metodo">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select></label>
            <label className="rt-chk rt-manual__chk"><input type="checkbox" checked={senaPagada} onChange={(e) => setSenaPagada(e.target.checked)} data-testid="rt-manual-sena-pagada" /><span>La seña ya está cobrada</span></label>
          </div>
        )}
        {senaTenedor === 'dueno' && <p className="rt-hint">Se registra como <strong>seña en poder del dueño</strong>. Nosotros cobramos el saldo.</p>}

        {total > 0 && (
          <div className="rt-manual__resumen" data-testid="rt-manual-resumen">
            <span>Total: <strong>{fmtMoney(total, mon)}</strong></span>
            <span>Seña: <strong>{fmtMoney(sena, mon)}</strong></span>
            <span>Saldo a cobrar: <strong>{fmtMoney(saldo, mon)}</strong></span>
          </div>
        )}

        <label className="rt-field"><span>Observaciones (opcional)</span>
          <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} data-testid="rt-manual-comentario" /></label>

        {err && <p className="rt__flash" style={{ color: '#e07575' }}>{err}</p>}
        <div className="rt-modal__foot">
          <Button variant="ghost" size="md" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={guardar} disabled={saving} data-testid="rt-manual-save">{saving ? 'Creando…' : 'Crear reserva'}</Button>
        </div>
      </div>
    </div>
  );
};

export default ReservaManual;
