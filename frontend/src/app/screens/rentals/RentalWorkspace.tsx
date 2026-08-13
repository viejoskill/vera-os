import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Upload, Star, CalendarX2, ExternalLink } from 'lucide-react';
import { Button, Input } from '@vera/ui';
import { api, fmtMoney, nightsBetween, ESTADOS, type RentalProperty, type Reservation, type RentalImage } from './api';
import { RentalCalendar } from './RentalCalendar';
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
  const [ocupados, setOcupados] = useState<{ checkIn: string; checkOut: string }[]>([]);
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [sel, setSel] = useState<{ checkIn: string | null; checkOut: string | null }>({ checkIn: null, checkOut: null });
  const [flash, setFlash] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof RentalProperty, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const loadRes = useCallback(async (propertyId: string) => {
    const r = await api.listReservations(propertyId);
    setReservas(r.filter((x) => x.estado !== 'bloqueo'));
    setOcupados(
      r.filter((x) => ['prereserva', 'confirmada', 'encurso', 'bloqueo'].includes(x.estado))
        .map((x) => ({ checkIn: x.checkIn, checkOut: x.checkOut })),
    );
  }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const p = await api.getProperty(id as string);
      setF(p); setSlug(p.slug); setImages(p.imagenes); setAmenText((p.amenities || []).join(', '));
      await loadRes(p.id);
    })();
  }, [id, isNew, loadRes]);

  const save = async () => {
    if (!f.titulo) { setFlash('Poné un título a la propiedad.'); return; }
    setSaving(true);
    const body = { ...f, amenities: amenText.split(',').map((a) => a.trim()).filter(Boolean) };
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

  const changeStatus = async (rid: string, estado: string) => {
    await api.setStatus(rid, estado);
    if (pid) await loadRes(pid);
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
        <h2 className="rt__title">{isNew ? 'Nueva propiedad' : f.titulo}</h2>
        <div className="rt__head-actions">
          {!isNew && <Button variant="ghost" size="sm" onClick={removeProp} data-testid="rt-delete-prop"><Trash2 size={14} /> Eliminar</Button>}
          <Button variant="primary" size="md" onClick={save} disabled={saving} data-testid="rt-save-prop"><Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </header>
      {flash && <p className="rt__flash" data-testid="rt-flash">{flash}</p>}

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

          <h3 className="rt-ws__sec">Precios · verano</h3>
          <div className="rt-row2">
            <label className="rt-field"><span>Moneda</span>
              <select value={f.moneda} onChange={(e) => set('moneda', e.target.value)} data-testid="rt-moneda">
                <option value="ARS">Pesos (ARS)</option><option value="USD">Dólares (USD)</option>
              </select></label>
            <Input label="Precio por noche" type="number" value={String(f.precioNoche ?? '')} onChange={(e) => set('precioNoche', Number(e.target.value))} data-testid="rt-precio" />
          </div>
          <p className="rt-hint">Descuentos automáticos por estadía (el cliente ve el total ya rebajado):</p>
          <div className="rt-row3">
            <Input label="% x semana (7+)" type="number" value={String(f.descSemana ?? '')} onChange={(e) => set('descSemana', Number(e.target.value))} data-testid="rt-desc-semana" />
            <Input label="% x quincena (15+)" type="number" value={String(f.descQuincena ?? '')} onChange={(e) => set('descQuincena', Number(e.target.value))} data-testid="rt-desc-quincena" />
            <Input label="% x mes (30+)" type="number" value={String(f.descMes ?? '')} onChange={(e) => set('descMes', Number(e.target.value))} data-testid="rt-desc-mes" />
          </div>
          <label className="rt-chk"><input type="checkbox" checked={!!f.activa} onChange={(e) => set('activa', e.target.checked)} data-testid="rt-activa" /><span>Publicada en la web (visible para reservar)</span></label>
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

          <h3 className="rt-ws__sec">Calendario y bloqueos</h3>
          {!pid ? <p className="rt-hint">Guardá la propiedad para gestionar el calendario.</p> : (
            <>
              <RentalCalendar ocupados={ocupados} value={sel} onChange={setSel} months={1} />
              {sel.checkIn && sel.checkOut && (
                <div className="rt-blockbar">
                  <span>{sel.checkIn} → {sel.checkOut} ({nightsBetween(sel.checkIn, sel.checkOut)} noches)</span>
                  <Button variant="secondary" size="sm" onClick={blockRange} data-testid="rt-block"><CalendarX2 size={14} /> Bloquear estas fechas</Button>
                </div>
              )}
              <p className="rt-hint">Tocá una fecha de inicio y otra de fin para bloquear (mantenimiento, uso propio, etc.).</p>
            </>
          )}
        </section>
      </div>

      {pid && (
        <section className="rt-ws__full">
          <h3 className="rt-ws__sec">Reservas de esta propiedad</h3>
          {reservas.length === 0 ? <p className="rt-hint">Todavía no hay reservas.</p> : (
            <div className="rt-res">
              {reservas.map((r) => {
                const e = ESTADOS[r.estado] || { label: r.estado, cls: 'rt-b--muted' };
                return (
                  <div className="rt-res__row" key={r.id} data-testid={`rt-wsres-${r.id}`}>
                    <div className="rt-res__main"><strong>{r.huesped.nombre}</strong><span className="rt-res__prop">{r.huesped.telefono} · {r.huesped.huespedes} huésp. · DNI {r.huesped.dni || '—'}</span></div>
                    <div className="rt-res__dates">{r.checkIn} → {r.checkOut} · {r.noches} noches</div>
                    <div className="rt-res__meta"><span>{fmtMoney(r.montoEstimado, r.moneda)}</span>{r.origen && <span className="rt-res__origin">{r.origen}</span>}<span className={`rt-b ${e.cls}`}>{e.label}</span></div>
                    <div className="rt-res__acts">
                      {r.estado === 'prereserva' && <>
                        <button type="button" className="rt-mini rt-mini--ok" onClick={() => changeStatus(r.id, 'confirmada')} data-testid={`rt-wsconfirm-${r.id}`}>Confirmar</button>
                        <button type="button" className="rt-mini rt-mini--no" onClick={() => changeStatus(r.id, 'cancelada')} data-testid={`rt-wscancel-${r.id}`}>Rechazar</button>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default RentalWorkspace;
