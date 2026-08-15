import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Upload, Star, CalendarX2, ExternalLink, UserPlus } from 'lucide-react';
import { Button, Input } from '@vera/ui';
import { api, fmtMoney, fmtDate, nightsBetween, displayEstado, TIPO_MOV, type RentalProperty, type Reservation, type RentalImage, type Movimiento, type Occupied } from './api';
import { RentalCalendar } from './RentalCalendar';
import { CobrarSena } from './CobrarSena';
import { ConfirmarReserva } from './ConfirmarReserva';
import { RechazarReserva } from './RechazarReserva';
import { WhatsappReserva } from './WhatsappReserva';
import { Comprobantes } from './Comprobantes';
import { CobrarSaldo } from './CobrarSaldo';
import { DocsReserva } from './DocsReserva';
import { ReservaManual } from './ReservaManual';
import { ReservaSemaforo } from './Semaforo';
import { AvisoPendientes } from './AvisoPendientes';
import { MoneyInput } from './MoneyInput';
import './rentals.css';

const empty: Partial<RentalProperty> = {
  titulo: '', direccion: '', localidad: 'Costa del Este', descripcion: '', capacidad: 4,
  dormitorios: 2, banos: 1, amenities: [], moneda: 'ARS', precioNoche: 0,
  descSemana: 0, descQuincena: 0, descMes: 0, activa: true,
};

export const RentalWorkspace = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id || id === 'nueva';
  const [f, setF] = useState<Partial<RentalProperty>>(empty);
  const [pid, setPid] = useState<string | null>(isNew ? null : (id as string));
  const [slug, setSlug] = useState('');
  const [images, setImages] = useState<RentalImage[]>([]);
  const [amenText, setAmenText] = useState('');
  const [owner, setOwner] = useState({ nombre: '', telefono: '', email: '', dni: '', observaciones: '' });
  const [ocupados, setOcupados] = useState<Occupied[]>([]);
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [bloqueos, setBloqueos] = useState<Reservation[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [nm, setNm] = useState({ fecha: '', tipo: 'ingreso', monto: '', descripcion: '', reservaId: '' });
  const [condText, setCondText] = useState('');
  const [confirming, setConfirming] = useState<Reservation | null>(null);
  const [rejecting, setRejecting] = useState<Reservation | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualDates, setManualDates] = useState<{ ci: string; co: string } | null>(null);
  const [wsTab, setWsTab] = useState('datos');
  const [sel, setSel] = useState<{ checkIn: string | null; checkOut: string | null }>({ checkIn: null, checkOut: null });
  const [flash, setFlash] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof RentalProperty, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const loadRes = useCallback(async (propertyId: string) => {
    const r = await api.listReservations(propertyId);
    setReservas(r.filter((x) => x.estado !== 'bloqueo'));
    setBloqueos(r.filter((x) => x.estado === 'bloqueo'));
    setOcupados(
      r.filter((x) => ['prereserva', 'confirmada', 'encurso', 'bloqueo'].includes(x.estado))
        .map((x) => ({ checkIn: x.checkIn, checkOut: x.checkOut, estado: x.estado })),
    );
  }, []);

  const delBlock = async (rid: string) => {
    if (!pid) return;
    await api.deleteReservation(rid);
    await loadRes(pid);
  };

  const loadMovs = useCallback(async (propertyId: string) => {
    setMovs(await api.listMovimientos(propertyId));
  }, []);

  const addMov = async () => {
    if (!pid || !nm.fecha || !nm.monto) { setFlash('Completá fecha y monto del movimiento.'); setTimeout(() => setFlash(''), 3000); return; }
    await api.createMovimiento({ propertyId: pid, fecha: nm.fecha, tipo: nm.tipo, monto: Number(nm.monto), descripcion: nm.descripcion, reservaId: nm.reservaId || null });
    setNm({ fecha: '', tipo: 'ingreso', monto: '', descripcion: '', reservaId: '' });
    await loadMovs(pid);
  };
  const delMov = async (mid: string) => { if (pid) { await api.deleteMovimiento(mid); await loadMovs(pid); } };

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const p = await api.getProperty(id as string);
      setF(p); setSlug(p.slug); setImages(p.imagenes); setAmenText((p.amenities || []).join(', '));
      setCondText((p.condiciones || []).join('\n'));
      setOwner({ nombre: '', telefono: '', email: '', dni: '', observaciones: '', ...(p.propietario || {}) });
      await loadRes(p.id);
      await loadMovs(p.id);
    })();
  }, [id, isNew, loadRes, loadMovs]);

  const save = async () => {
    if (!f.titulo) { setFlash('Poné un título a la propiedad.'); return; }
    setSaving(true);
    const body = { ...f, amenities: amenText.split(',').map((a) => a.trim()).filter(Boolean), condiciones: condText.split('\n').map((c) => c.trim()).filter(Boolean), propietario: owner };
    try {
      if (pid) {
        const p = await api.updateProperty(pid, body);
        setF(p); setSlug(p.slug);
        setFlash('Cambios guardados ✅');
      } else {
        const p = await api.createProperty(body);
        setPid(p.id); setSlug(p.slug);
        setFlash('Propiedad creada. Ahora subí fotos y configurá el calendario.');
        nav(`/alquileres/${p.id}`, { replace: true });
      }
    } catch (e) { setFlash((e as Error).message); }
    setSaving(false);
    setTimeout(() => setFlash(''), 3500);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pid || !e.target.files?.length) return;
    setFlash('Subiendo fotos…');
    for (const file of Array.from(e.target.files)) {
      const img = await api.uploadImage(pid, file);
      setImages((s) => [...s, img]);
    }
    setFlash('Fotos subidas ✅'); setTimeout(() => setFlash(''), 2500);
  };

  const delImage = async (imgId: string) => {
    if (!pid) return;
    await api.deleteImage(pid, imgId);
    setImages((s) => s.filter((i) => i.id !== imgId));
  };

  const blockRange = async () => {
    if (!pid || !sel.checkIn || !sel.checkOut) return;
    try {
      await api.createBlock({ propertyId: pid, checkIn: sel.checkIn, checkOut: sel.checkOut, motivo: 'Bloqueo manual' });
      setSel({ checkIn: null, checkOut: null });
      await loadRes(pid);
      setFlash('Fechas bloqueadas ✅'); setTimeout(() => setFlash(''), 2500);
    } catch (e) { setFlash((e as Error).message); setTimeout(() => setFlash(''), 3500); }
  };

  const removeReserva = async (rid: string) => {
    if (!pid || !window.confirm('¿Eliminar esta reserva de la lista? No se puede deshacer.')) return;
    await api.deleteReservation(rid);
    await loadRes(pid);
  };

  const finalizarReserva = async (rid: string) => {
    if (!pid || !window.confirm('¿Marcar esta reserva como finalizada? Saldrá de "Confirmadas" y quedará en "Finalizadas".')) return;
    await api.setStatus(rid, 'finalizada');
    await loadRes(pid);
  };

  const reabrirReserva = async (rid: string) => {
    if (!pid) return;
    await api.setStatus(rid, 'confirmada');
    await loadRes(pid);
  };

  const removeProp = async () => {
    if (!pid || !window.confirm('¿Eliminar esta propiedad y todas sus reservas?')) return;
    await api.deleteProperty(pid); nav('/alquileres');
  };

  return (
    <div className="vera-screen rt" data-testid="rental-workspace">
      <div className="rt__back">
        <button type="button" onClick={() => nav('/alquileres')} data-testid="rt-back"><ArrowLeft size={16} /> Volver a Alquileres</button>
        {slug && <a href={`/reservar/${slug}`} target="_blank" rel="noreferrer" className="rt__weblink"><ExternalLink size={14} /> Ver página pública</a>}
      </div>

      <header className="rt__head">
        <h2 className="rt__title">{isNew ? 'Nueva propiedad' : <>{f.codigo && <span className="rt-ws__code">{f.codigo}</span>}{f.titulo}</>}</h2>
        <div className="rt__head-actions">
          {!isNew && <Button variant="ghost" size="sm" onClick={removeProp} data-testid="rt-delete-prop"><Trash2 size={14} /> Eliminar</Button>}
          <Button variant="primary" size="md" onClick={save} disabled={saving} data-testid="rt-save-prop"><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </header>
      {flash && <p className="rt__flash" data-testid="rt-flash">{flash}</p>}
      {pid && !f.activa && (
        <div className="rt-notice" data-testid="rt-hidden-notice">
          🔒 Esta propiedad está <strong>oculta</strong> y no aparece en la web pública. Para publicarla, cargá el <strong>precio por noche</strong> y activá <strong>“Publicada en la web”</strong> (más abajo), luego <strong>Guardá</strong>.
        </div>
      )}

      <div className="rt__tabs" data-testid="rt-ws-tabs">
        {(([['datos', 'Datos de la propiedad'], ['precios', 'Precios'], ['propietario', 'Propietario'], ['reservas', 'Reservas'], ['financiera', 'Ficha financiera']]) as [string, string][]).map(([t, label]) => {
          const prereservas = reservas.filter((r) => r.estado === 'prereserva').length;
          return (
            <button type="button" key={t} className={wsTab === t ? 'sel' : ''} onClick={() => setWsTab(t)} data-testid={`rt-wstab-${t}`}>
              {label}
              {t === 'reservas' && prereservas > 0 && <span className="rt-tabbadge">{prereservas}</span>}
            </button>
          );
        })}
      </div>

      {wsTab === 'datos' && (
        <div className="rt-ws">
          <section className="rt-ws__col">
            <h3 className="rt-ws__sec">Datos de la propiedad</h3>
            <Input label="Título" value={f.titulo || ''} onChange={(e) => set('titulo', e.target.value)} data-testid="rt-titulo" />
            <div className="rt-row2">
              <Input label="Dirección" value={f.direccion || ''} onChange={(e) => set('direccion', e.target.value)} data-testid="rt-direccion" />
              <Input label="Localidad" value={f.localidad || ''} onChange={(e) => set('localidad', e.target.value)} data-testid="rt-localidad" />
            </div>
            <label className="rt-field"><span>Descripción</span>
              <textarea rows={4} value={f.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} data-testid="rt-descripcion" /></label>
            <div className="rt-row3">
              <Input label="Capacidad (huéspedes)" type="number" value={String(f.capacidad ?? '')} onChange={(e) => set('capacidad', Number(e.target.value))} data-testid="rt-capacidad" />
              <Input label="Dormitorios" type="number" value={String(f.dormitorios ?? '')} onChange={(e) => set('dormitorios', Number(e.target.value))} data-testid="rt-dormitorios" />
              <Input label="Baños" type="number" value={String(f.banos ?? '')} onChange={(e) => set('banos', Number(e.target.value))} data-testid="rt-banos" />
            </div>
            <label className="rt-field"><span>Amenities (separados por coma)</span>
              <input value={amenText} onChange={(e) => setAmenText(e.target.value)} placeholder="Wifi, Parrilla, Cochera, Pileta" data-testid="rt-amenities" /></label>

            <h3 className="rt-ws__sec">Observaciones de la propiedad</h3>
            <label className="rt-field"><span>Notas internas (historial, detalles, lo que necesites)</span>
              <textarea rows={3} value={f.notas || ''} onChange={(e) => set('notas', e.target.value)} data-testid="rt-notas" /></label>

            <h3 className="rt-ws__sec">Condiciones de la reserva</h3>
            <p className="rt-hint">El huésped las tiene que leer y aceptar antes de enviar la pre-reserva (junto con las condiciones generales de la inmobiliaria).</p>
            <div className="rt-cond__toggles">
              <label className="rt-chk"><input type="checkbox" checked={!!f.ropaBlanca} onChange={(e) => set('ropaBlanca', e.target.checked)} data-testid="rt-ropablanca" /><span>Incluye ropa blanca</span></label>
              <label className="rt-chk"><input type="checkbox" checked={!!f.aceptaMascotas} onChange={(e) => set('aceptaMascotas', e.target.checked)} data-testid="rt-mascotas" /><span>Se aceptan mascotas</span></label>
            </div>
            <div className="rt-row3">
              <MoneyInput label="Depósito en garantía" prefix={f.moneda === 'USD' ? 'USD' : '$'} value={f.depositoGarantia} onChange={(n) => set('depositoGarantia', n)} testId="rt-deposito" />
              <Input label="Estadía mínima (noches)" type="number" value={String(f.estadiaMinima ?? '')} onChange={(e) => set('estadiaMinima', Number(e.target.value))} data-testid="rt-estadia-min" />
              <MoneyInput label="Adicional limpieza" prefix={f.moneda === 'USD' ? 'USD' : '$'} value={f.limpieza} onChange={(n) => set('limpieza', n)} testId="rt-limpieza" />
            </div>
            <div className="rt-row3">
              <Input label="Check-in (horario)" value={f.checkInHora || ''} onChange={(e) => set('checkInHora', e.target.value)} data-testid="rt-checkin-hora" />
              <Input label="Check-out (horario)" value={f.checkOutHora || ''} onChange={(e) => set('checkOutHora', e.target.value)} data-testid="rt-checkout-hora" />
              <MoneyInput label="Penalidad diaria (contrato)" prefix={f.moneda === 'USD' ? 'USD' : '$'} value={f.penalidadDiaria} onChange={(n) => set('penalidadDiaria', n)} testId="rt-penalidad" />
            </div>
            <p className="rt-hint">La limpieza y la penalidad diaria se usan en el documento de reserva y en el contrato. Si las dejás en cero, se usan valores por defecto ($40.000 / $50.000 limpieza y una noche de penalidad).</p>
            <label className="rt-field"><span>Cláusulas propias (una por línea)</span>
              <textarea rows={3} value={condText} onChange={(e) => setCondText(e.target.value)} placeholder={'No se permiten fiestas\nSolo grupos familiares\nProhibido fumar'} data-testid="rt-condiciones" /></label>
          </section>

          <section className="rt-ws__col">
            <h3 className="rt-ws__sec">Fotos</h3>
            {!pid ? <p className="rt-hint">Guardá la propiedad para poder subir fotos.</p> : (
              <>
                <label className="rt-upload" data-testid="rt-upload">
                  <Upload size={16} /> Subir fotos
                  <input type="file" accept="image/*" multiple onChange={onUpload} hidden />
                </label>
                <div className="rt-thumbs">
                  {images.map((im) => (
                    <div className="rt-thumb" key={im.id} style={{ backgroundImage: `url(${im.url})` }} data-testid={`rt-thumb-${im.id}`}>
                      {im.isCover && <span className="rt-thumb__cover"><Star size={12} /> Portada</span>}
                      <button type="button" onClick={() => delImage(im.id)} data-testid={`rt-delimg-${im.id}`}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {wsTab === 'precios' && (
        <section className="rt-ws__full rt-ws__pane">
          <h3 className="rt-ws__sec">Precios · verano</h3>
          <div className="rt-row2">
            <label className="rt-field"><span>Moneda</span>
              <select value={f.moneda} onChange={(e) => set('moneda', e.target.value)} data-testid="rt-moneda">
                <option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (USD)</option>
              </select></label>
            <MoneyInput label="Precio por noche" prefix={f.moneda === 'USD' ? 'USD' : '$'} value={f.precioNoche} onChange={(n) => set('precioNoche', n)} testId="rt-precio" />
          </div>
          <p className="rt-hint">Descuentos automáticos por estadía (el cliente ve el total ya rebajado):</p>
          <div className="rt-row3">
            <Input label="% x semana (7+)" type="number" value={String(f.descSemana ?? '')} onChange={(e) => set('descSemana', Number(e.target.value))} data-testid="rt-desc-semana" />
            <Input label="% x quincena (15+)" type="number" value={String(f.descQuincena ?? '')} onChange={(e) => set('descQuincena', Number(e.target.value))} data-testid="rt-desc-quincena" />
            <Input label="% x mes (30+)" type="number" value={String(f.descMes ?? '')} onChange={(e) => set('descMes', Number(e.target.value))} data-testid="rt-desc-mes" />
          </div>
          <div className="rt-row2">
            <Input label="Comisión (%)" type="number" value={String(f.comisionPct ?? '')} onChange={(e) => set('comisionPct', Number(e.target.value))} data-testid="rt-comision-pct" />
            <MoneyInput label="Comisión mínima" value={f.comisionMinima} onChange={(n) => set('comisionMinima', n)} testId="rt-comision-min" />
          </div>
          <p className="rt-hint">La comisión se genera sola al confirmar una reserva (podés editarla en la ficha). Si el % da menos que el mínimo, se usa el mínimo.</p>
          <label className="rt-chk"><input type="checkbox" checked={!!f.activa} onChange={(e) => set('activa', e.target.checked)} data-testid="rt-activa" /><span>Publicada en la web (visible para reservar)</span></label>
        </section>
      )}

      {wsTab === 'propietario' && (
        <section className="rt-ws__full rt-ws__pane">
          <h3 className="rt-ws__sec">Propietario</h3>
          <div className="rt-row2">
            <Input label="Nombre y apellido" value={owner.nombre} onChange={(e) => setOwner((s) => ({ ...s, nombre: e.target.value }))} data-testid="rt-owner-nombre" />
            <Input label="Teléfono / WhatsApp" value={owner.telefono} onChange={(e) => setOwner((s) => ({ ...s, telefono: e.target.value }))} data-testid="rt-owner-telefono" />
          </div>
          <div className="rt-row2">
            <Input label="Email" value={owner.email} onChange={(e) => setOwner((s) => ({ ...s, email: e.target.value }))} data-testid="rt-owner-email" />
            <Input label="DNI / CUIT" value={owner.dni} onChange={(e) => setOwner((s) => ({ ...s, dni: e.target.value }))} data-testid="rt-owner-dni" />
          </div>
          <label className="rt-field"><span>Observaciones (uso interno)</span>
            <textarea rows={2} value={owner.observaciones} onChange={(e) => setOwner((s) => ({ ...s, observaciones: e.target.value }))} data-testid="rt-owner-obs" /></label>
        </section>
      )}

      {wsTab === 'reservas' && (
        !pid ? <p className="rt-hint">Guardá la propiedad para gestionar el calendario y las reservas.</p> : (
          <>
            <section className="rt-ws__full">
              <h3 className="rt-ws__sec">Calendario y bloqueos</h3>
              <RentalCalendar ocupados={ocupados} value={sel} onChange={setSel} months={3} legend className="rt-cal--compact" />
              {sel.checkIn && sel.checkOut && (
                <div className="rt-blockbar">
                  <span>{fmtDate(sel.checkIn)} → {fmtDate(sel.checkOut)} ({nightsBetween(sel.checkIn, sel.checkOut)} noches)</span>
                  <Button variant="primary" size="sm" onClick={() => { setManualDates({ ci: sel.checkIn!, co: sel.checkOut! }); setShowManual(true); }} data-testid="rt-reservar-fechas"><UserPlus size={14} /> Reservar estas fechas</Button>
                  <Button variant="secondary" size="sm" onClick={blockRange} data-testid="rt-block"><CalendarX2 size={14} /> Bloquear estas fechas</Button>
                </div>
              )}
              <p className="rt-hint">Tocá una fecha de inicio y otra de fin para bloquear (mantenimiento, uso propio, etc.).</p>
              {bloqueos.length > 0 && (
                <div className="rt-blocks" data-testid="rt-blocks">
                  <p className="rt-blocks__title">Fechas bloqueadas</p>
                  {bloqueos.map((b) => (
                    <div className="rt-blocks__row" key={b.id} data-testid={`rt-block-${b.id}`}>
                      <span>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.noches} noches{b.motivo ? ` · ${b.motivo}` : ''}</span>
                      <button type="button" onClick={() => delBlock(b.id)} data-testid={`rt-delblock-${b.id}`}><Trash2 size={13} /> Quitar</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rt-ws__full">
              <div className="rt-ws__sechead">
                <h3 className="rt-ws__sec">Reservas de esta propiedad</h3>
                <Button variant="secondary" size="sm" onClick={() => { setManualDates(null); setShowManual(true); }} data-testid="rt-manual-open"><UserPlus size={14} /> Reserva manual</Button>
              </div>
              <AvisoPendientes reservas={reservas} />
              {reservas.length === 0 ? <p className="rt-hint">Todavía no hay reservas.</p> : (
                <div className="rt-res">
                  {reservas.map((r) => {
                    const e = displayEstado(r);
                    return (
                      <div className="rt-res__row" key={r.id} data-testid={`rt-wsres-${r.id}`}>
                        <div className="rt-res__main"><strong>{r.huesped.nombre}</strong><span className="rt-res__prop">{r.huesped.telefono} · {r.huesped.huespedes} huésp. · DNI {r.huesped.dni || '—'}</span></div>
                        <div className="rt-res__dates">{fmtDate(r.checkIn)} → {fmtDate(r.checkOut)} · {r.noches} noches</div>
                        <div className="rt-res__meta"><span className="rt-res__monto">{fmtMoney(r.montoEstimado, r.moneda)}</span>{r.origen && <span className="rt-res__origin">{r.origen}</span>}<span className={`rt-b ${e.cls}`}>{e.label}</span><ReservaSemaforo reserva={r} /></div>
                        <div className="rt-res__acts">
                          {r.estado === 'prereserva' && <>
                            <button type="button" className="rt-mini rt-mini--ok" onClick={() => setConfirming(r)} data-testid={`rt-wsconfirm-${r.id}`}>Confirmar</button>
                            <button type="button" className="rt-mini rt-mini--no" onClick={() => setRejecting(r)} data-testid={`rt-wscancel-${r.id}`}>Rechazar</button>
                          </>}
                          {r.estado === 'confirmada' && (
                            <button type="button" className="rt-mini rt-mini--no" onClick={() => setRejecting(r)} data-testid={`rt-wscancel-${r.id}`}>Cancelar</button>
                          )}
                          {r.estado === 'confirmada' && <CobrarSena reserva={r} onUpdated={() => pid && loadRes(pid)} />}
                          <CobrarSaldo reserva={r} onUpdated={() => pid && loadRes(pid)} />
                          {r.huesped.telefono && <WhatsappReserva reserva={r} />}
                          <DocsReserva reserva={r} />
                          <Comprobantes reserva={r} onUpdated={() => pid && loadRes(pid)} />
                          {r.estado === 'confirmada' && (
                            <button type="button" className="rt-mini" onClick={() => finalizarReserva(r.id)} data-testid={`rt-wsfinalizar-${r.id}`}>Finalizar</button>
                          )}
                          {r.estado === 'finalizada' && (
                            <button type="button" className="rt-mini" onClick={() => reabrirReserva(r.id)} data-testid={`rt-wsreabrir-${r.id}`}>Reabrir</button>
                          )}
                          {(r.estado === 'cancelada' || r.estado === 'finalizada') && (
                            <button type="button" className="rt-mini rt-mini--del" onClick={() => removeReserva(r.id)} data-testid={`rt-wsdelres-${r.id}`}><Trash2 size={13} /> Eliminar</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )
      )}

      {wsTab === 'financiera' && (
        !pid ? <p className="rt-hint">Guardá la propiedad para cargar la ficha financiera.</p> : (
          <section className="rt-ws__full">
            <h3 className="rt-ws__sec">Ficha financiera</h3>
            <div className="rt-mov__add" data-testid="rt-mov-add">
              <input type="date" value={nm.fecha} onChange={(e) => setNm((s) => ({ ...s, fecha: e.target.value }))} data-testid="rt-mov-fecha" />
              <select value={nm.tipo} onChange={(e) => setNm((s) => ({ ...s, tipo: e.target.value }))} data-testid="rt-mov-tipo">
                {Object.entries(TIPO_MOV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="number" placeholder="Monto" value={nm.monto} onChange={(e) => setNm((s) => ({ ...s, monto: e.target.value }))} data-testid="rt-mov-monto" />
              <input placeholder="Descripción" value={nm.descripcion} onChange={(e) => setNm((s) => ({ ...s, descripcion: e.target.value }))} data-testid="rt-mov-desc" />
              <select value={nm.reservaId} onChange={(e) => setNm((s) => ({ ...s, reservaId: e.target.value }))} data-testid="rt-mov-reserva" title="Imputar a una reserva (opcional)">
                <option value="">Sin reserva (general)</option>
                {reservas.map((r) => <option key={r.id} value={r.id}>{r.huesped.nombre || 'Reserva'} · {fmtDate(r.checkIn)}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={addMov} data-testid="rt-mov-save">Agregar</Button>
            </div>
            <p className="rt-hint">Podés dejar el gasto como <strong>general</strong> de la propiedad o <strong>imputarlo a una reserva</strong>. En la liquidación por reserva se suman los movimientos imputados y, además, los gastos generales que caigan dentro de las fechas de la estadía.</p>
            {movs.length === 0 ? <p className="rt-hint">Sin movimientos cargados.</p> : (
              <div className="rt-mov">
                {movs.map((m) => {
                  const res = m.reservaId ? reservas.find((r) => r.id === m.reservaId) : null;
                  return (
                  <div className={`rt-mov__row rt-mov__row--${m.tipo}`} key={m.id} data-testid={`rt-mov-${m.id}`}>
                    <span className="rt-mov__fecha">{fmtDate(m.fecha)}</span>
                    <span className="rt-mov__tipo">{TIPO_MOV[m.tipo] || m.tipo}</span>
                    <span className="rt-mov__desc">{m.descripcion}{res && <span className="rt-mov__imput" data-testid={`rt-mov-imput-${m.id}`}>↳ {res.huesped.nombre || 'reserva'}</span>}</span>
                    <span className="rt-mov__monto">{fmtMoney(m.monto, f.moneda)}</span>
                    <button type="button" onClick={() => delMov(m.id)} data-testid={`rt-delmov-${m.id}`}><Trash2 size={13} /></button>
                  </div>
                  );
                })}
              </div>
            )}
            <p className="rt-hint">Las liquidaciones al propietario se arman en la sección <strong>Liquidaciones</strong> (menú lateral), eligiendo la propiedad y el período.</p>
          </section>
        )
      )}
      {confirming && (
        <ConfirmarReserva reserva={confirming} onClose={() => setConfirming(null)}
          onConfirmed={async () => { setConfirming(null); if (pid) await loadRes(pid); }} />
      )}
      {rejecting && (
        <RechazarReserva reserva={rejecting} onClose={() => setRejecting(null)}
          onDone={async () => { setRejecting(null); if (pid) await loadRes(pid); }} />
      )}
      {showManual && pid && (
        <ReservaManual
          property={{ ...(f as RentalProperty), id: pid, slug }}
          initialCheckIn={manualDates?.ci}
          initialCheckOut={manualDates?.co}
          onClose={() => { setShowManual(false); setManualDates(null); }}
          onCreated={async () => { setShowManual(false); setManualDates(null); if (pid) await loadRes(pid); }}
        />
      )}
    </div>
  );
};

export default RentalWorkspace;
