import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Users, BedDouble, Bath, MapPin, Check, CheckCircle2, ArrowLeft, X, ShieldCheck, PawPrint, BedSingle, Clock, Wallet, AlertCircle } from 'lucide-react';
import { api, fmtMoney, nightsBetween, type RentalProperty, type RentalSettings } from '@app/screens/rentals/api';
import { RentalCalendar } from '@app/screens/rentals/RentalCalendar';
import '@app/screens/rentals/rentals.css';

interface Quote { noches: number; base: number; descuentoPct: number; total: number; moneda: string; }

export const ReservarPropiedad = () => {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const origen = sp.get('origen') === 'ml' ? 'MercadoLibre' : 'Directo';
  const [p, setP] = useState<RentalProperty | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [gallery, setGallery] = useState(0);
  const [sel, setSel] = useState<{ checkIn: string | null; checkOut: string | null }>({ checkIn: null, checkOut: null });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [g, setG] = useState({ nombre: '', telefono: '', email: '', dni: '', huespedes: 2, comentario: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<RentalSettings>({ condicionesGenerales: [], avisoValidez: '' });
  const [showCond, setShowCond] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => { if (slug) api.publicProperty(slug).then(setP).catch(() => setNotFound(true)); }, [slug]);
  useEffect(() => { api.getSettings().then(setSettings).catch(() => {}); }, []);

  useEffect(() => {
    if (!slug || !sel.checkIn || !sel.checkOut) { setQuote(null); return; }
    api.quote(slug, sel.checkIn, sel.checkOut).then(setQuote).catch(() => setQuote(null));
  }, [slug, sel]);

  const setG2 = (k: keyof typeof g, v: unknown) => setG((s) => ({ ...s, [k]: v }));
  const cover = useMemo(() => (p ? (p.imagenes[gallery] || p.imagenes[0]) : null), [p, gallery]);

  const submit = () => {
    if (!slug) return;
    if (!sel.checkIn || !sel.checkOut) { setError('Elegí las fechas en el calendario.'); return; }
    if (!g.nombre || !g.telefono) { setError('Necesitamos tu nombre y teléfono.'); return; }
    if (p?.estadiaMinima && nightsBetween(sel.checkIn, sel.checkOut) < p.estadiaMinima) {
      setError(`La estadía mínima en esta propiedad es de ${p.estadiaMinima} noches.`); return;
    }
    setError(''); setAccepted(false); setShowCond(true);
  };

  const confirmAndSend = async () => {
    if (!slug || !sel.checkIn || !sel.checkOut || !accepted) return;
    setSending(true);
    try {
      await api.prereserva(slug, { ...g, huespedes: Number(g.huespedes), checkIn: sel.checkIn, checkOut: sel.checkOut, origen, aceptaCondiciones: true });
      setShowCond(false); setDone(true);
    } catch (e) { setError((e as Error).message); setShowCond(false); }
    setSending(false);
  };

  if (notFound) return <div className="rt-pub rt-pub--center" data-testid="rt-notfound"><p>Esta propiedad no está disponible.</p><Link to="/reservar" className="rt-pub__back"><ArrowLeft size={15} /> Ver todas</Link></div>;
  if (!p) return <div className="rt-pub rt-pub--center"><p className="rt-pub__loading">Cargando…</p></div>;

  if (done) return (
    <div className="rt-pub rt-pub--center" data-testid="rt-prereserva-ok">
      <div className="rt-ok"><CheckCircle2 size={44} /><h2>¡Pre-reserva enviada!</h2>
        <p>Recibimos tu solicitud para <strong>{p.titulo}</strong> del <strong>{sel.checkIn}</strong> al <strong>{sel.checkOut}</strong>.</p>
        <p>Un asesor de Varela te va a contactar para <strong>confirmar la disponibilidad</strong> y coordinar el pago. ¡Gracias!</p>
        <Link to="/reservar" className="rt-pub__back"><ArrowLeft size={15} /> Ver otras propiedades</Link>
      </div>
    </div>
  );

  return (
    <div className="rt-pub" data-testid="reservar-propiedad">
      <header className="rt-pub__topbar"><Link to="/reservar"><img src="/varela-logo-brand.png" alt="Varela" /></Link></header>

      <div className="rt-detail">
        <div className="rt-detail__gallery">
          <div className="rt-detail__main" style={cover ? { backgroundImage: `url(${cover.url})` } : undefined} data-testid="rt-gallery-main" />
          {p.imagenes.length > 1 && (
            <div className="rt-detail__thumbs">
              {p.imagenes.map((im, i) => (
                <button type="button" key={im.id} className={i === gallery ? 'sel' : ''} style={{ backgroundImage: `url(${im.url})` }} onClick={() => setGallery(i)} data-testid={`rt-gthumb-${i}`} />
              ))}
            </div>
          )}
        </div>

        <div className="rt-detail__info">
          <h1>{p.titulo}</h1>
          {p.codigo && <p className="rt-detail__code" data-testid="rt-detail-code">Cód. {p.codigo}</p>}
          <p className="rt-detail__addr"><MapPin size={15} /> {p.direccion ? `${p.direccion} · ` : ''}{p.localidad}</p>
          <div className="rt-detail__specs">
            <span><Users size={16} /> {p.capacidad} huéspedes</span>
            <span><BedDouble size={16} /> {p.dormitorios} dorm.</span>
            <span><Bath size={16} /> {p.banos} baños</span>
          </div>
          {p.descripcion && <p className="rt-detail__desc">{p.descripcion}</p>}
          {p.amenities.length > 0 && (
            <ul className="rt-detail__amen">{p.amenities.map((a) => <li key={a}><Check size={14} /> {a}</li>)}</ul>
          )}
        </div>
      </div>

      <div className="rt-book" data-testid="rt-book">
        <div className="rt-book__cal">
          <h3>Elegí tus fechas</h3>
          <RentalCalendar ocupados={p.ocupados || []} value={sel} onChange={setSel} months={2} />
        </div>

        <aside className="rt-book__panel">
          <p className="rt-book__from">{fmtMoney(p.precioNoche, p.moneda)} <em>/ noche</em></p>
          {quote ? (
            <div className="rt-book__quote" data-testid="rt-quote">
              <div className="rt-book__line"><span>{fmtMoney(p.precioNoche, p.moneda)} × {quote.noches} noches</span><span>{fmtMoney(quote.base, quote.moneda)}</span></div>
              {quote.descuentoPct > 0 && <div className="rt-book__line rt-book__line--disc"><span>Descuento por estadía ({quote.descuentoPct}%)</span><span>-{fmtMoney(quote.base - quote.total, quote.moneda)}</span></div>}
              <div className="rt-book__total"><span>Total estimado</span><strong data-testid="rt-total">{fmtMoney(quote.total, quote.moneda)}</strong></div>
            </div>
          ) : <p className="rt-book__hint">Seleccioná check-in y check-out para ver el total.</p>}

          <div className="rt-book__form">
            <input placeholder="Nombre y apellido" value={g.nombre} onChange={(e) => setG2('nombre', e.target.value)} data-testid="rt-g-nombre" />
            <input placeholder="Teléfono / WhatsApp" value={g.telefono} onChange={(e) => setG2('telefono', e.target.value)} data-testid="rt-g-telefono" />
            <input placeholder="Email" value={g.email} onChange={(e) => setG2('email', e.target.value)} data-testid="rt-g-email" />
            <div className="rt-row2">
              <input placeholder="DNI" value={g.dni} onChange={(e) => setG2('dni', e.target.value)} data-testid="rt-g-dni" />
              <input type="number" min={1} placeholder="Huéspedes" value={g.huespedes} onChange={(e) => setG2('huespedes', e.target.value)} data-testid="rt-g-huespedes" />
            </div>
            <textarea rows={2} placeholder="Comentario (opcional)" value={g.comentario} onChange={(e) => setG2('comentario', e.target.value)} data-testid="rt-g-comentario" />
          </div>

          {error && <p className="rt-book__error" data-testid="rt-book-error">{error}</p>}
          <button type="button" className="rt-book__cta" onClick={submit} disabled={sending} data-testid="rt-prereservar">
            {sending ? 'Enviando…' : 'Solicitar pre-reserva'}
          </button>
          <p className="rt-book__note">No se cobra nada ahora. Confirmamos disponibilidad y coordinamos el pago con vos.</p>
        </aside>
      </div>

      {showCond && p && (
        <div className="rt-modal" data-testid="rt-cond-modal" onClick={() => setShowCond(false)}>
          <div className="rt-modal__box rt-cond" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal__head">
              <h3><ShieldCheck size={18} /> Condiciones de la reserva</h3>
              <button type="button" onClick={() => setShowCond(false)} data-testid="rt-cond-close"><X size={18} /></button>
            </div>
            <p className="rt-modal__sub">Leé las condiciones de <strong>{p.titulo}</strong> antes de enviar tu solicitud.</p>

            <ul className="rt-cond__facts">
              <li><BedSingle size={15} /> {p.ropaBlanca ? 'Incluye ropa blanca' : 'No incluye ropa blanca'}</li>
              <li><PawPrint size={15} /> {p.aceptaMascotas ? 'Se aceptan mascotas' : 'No se aceptan mascotas'}</li>
              {p.depositoGarantia ? <li><Wallet size={15} /> Depósito en garantía: {fmtMoney(p.depositoGarantia, p.moneda)}</li> : null}
              {(p.checkInHora || p.checkOutHora) ? <li><Clock size={15} /> Check-in {p.checkInHora || '—'} · Check-out {p.checkOutHora || '—'}</li> : null}
              {p.estadiaMinima ? <li><AlertCircle size={15} /> Estadía mínima: {p.estadiaMinima} noches</li> : null}
            </ul>

            {(p.condiciones?.length || settings.condicionesGenerales.length) ? (
              <ul className="rt-cond__list" data-testid="rt-cond-list">
                {[...(settings.condicionesGenerales || []), ...(p.condiciones || [])].map((c, i) => (
                  <li key={i}><Check size={13} /> {c}</li>
                ))}
              </ul>
            ) : null}

            <div className="rt-cond__notice">{settings.avisoValidez || 'Esta pre-reserva tiene una validez de 24 horas y queda sujeta a confirmación de la inmobiliaria.'}</div>

            <label className="rt-cond__accept" data-testid="rt-cond-accept-wrap">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} data-testid="rt-cond-accept" />
              <span>Declaro haber leído y aceptado las condiciones de la reserva.</span>
            </label>

            <button type="button" className="rt-book__cta" onClick={confirmAndSend} disabled={!accepted || sending} data-testid="rt-cond-confirm">
              {sending ? 'Enviando…' : 'Confirmar y enviar pre-reserva'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservarPropiedad;
