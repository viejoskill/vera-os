import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BedDouble, Bath, Maximize, MapPin, MessageCircle, ArrowRight, Menu, X,
  Gauge, Bot, MessagesSquare, Radar, ShieldCheck, MapPinned, Sparkles, Handshake,
  Mail, Umbrella, Star, Quote,
} from 'lucide-react';
import { env } from '@vera/config';
import { openWhatsAppInquiry } from './whatsappInquiry';
import { REVIEWS, GOOGLE_RATING, GOOGLE_TOTAL, GOOGLE_REVIEW_URL } from './reviews';

const WA_VENTAS = '5492246586030';
const WA_ALQUILERES = '5492257404000';
const PORTAL_URL = 'http://177.7.35.221/portal';
const ALQUILERES_URL = 'https://alquileres.varelapropiedadescde.com.ar';
const LOGO = '/varela-logo-brand.png';
const SEBASTIAN = '/sebastian.jpg';
const HERO_BG = '/home-hero.jpg';
const RENTALS_BG = '/home-rentals.jpg';

const wa = (num: string, msg: string) => `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;

interface Listing {
  id: string; code: string; title: string; type: string; operation: string;
  price: number; currency: string; city: string; neighborhood: string;
  coverImage: string; bedrooms: number; bathrooms: number; areaM2: number;
  lotAreaM2: number; rooms: number; status: string; radar: boolean; whatsappUrl: string; publicUrl: string;
}

const money = (n: number, c: string) =>
  n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const STAMP: Record<string, { label: string; cls: string }> = {
  sold: { label: 'VENDIDA', cls: 'vh-stamp--sold' },
  reserved: { label: 'RESERVADA', cls: 'vh-stamp--reserved' },
};
const PRICE_STEPS = [50000, 100000, 150000, 200000, 300000, 500000];
const ROOM_STEPS = ['2', '3', '4'];

/** Cuenta ascendente al entrar en viewport. */
const useCountUp = (target: number, run: boolean, ms = 1400) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return val;
};

const useInView = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSeen(true)),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
};

const Stars = ({ n }: { n: number }) => (
  <span className="vh-stars" aria-label={`${n} de 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={15} fill={i <= Math.round(n) ? '#F6E63A' : 'none'} color={i <= Math.round(n) ? '#F6E63A' : '#3f3f46'} />
    ))}
  </span>
);

const PropCard = ({ p }: { p: Listing }) => {
  const stamp = STAMP[p.status];
  return (
    <Link to={`/web/${p.id}`} className="vh-card" data-testid={`home-card-${p.id}`}>
      <div className="vh-card__media">
        {p.coverImage ? <img src={p.coverImage} alt={p.title} loading="lazy" /> : <div className="vh-card__noimg" />}
        <span className="vh-card__op">{cap(p.operation)}</span>
        {stamp && <span className={`vh-stamp ${stamp.cls}`}>{stamp.label}</span>}
      </div>
      <div className="vh-card__body">
        <span className="vh-card__price">{money(p.price, p.currency)}</span>
        <h3 className="vh-card__title">{p.title}</h3>
        <span className="vh-card__loc"><MapPin size={13} /> {[p.neighborhood, p.city].filter(Boolean).join(', ')}</span>
        <div className="vh-card__specs">
          {p.bedrooms > 0 && <span><BedDouble size={14} /> {p.bedrooms}</span>}
          {p.bathrooms > 0 && <span><Bath size={14} /> {p.bathrooms}</span>}
          {(p.areaM2 > 0 || p.lotAreaM2 > 0) && <span><Maximize size={14} /> {p.areaM2 || p.lotAreaM2} m²</span>}
        </div>
        <div className="vh-card__foot">
          <span className="vh-card__code">{p.code}</span>
          {p.status !== 'sold' && p.whatsappUrl && (
            <button
              type="button"
              className="vh-card__wa"
              data-testid={`home-card-wa-${p.id}`}
              aria-label="Consultar por WhatsApp"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWhatsAppInquiry(p.id, p.whatsappUrl); }}
            >
              <MessageCircle size={15} /> Consultar
            </button>
          )}
        </div>
      </div>
    </Link>
  );
};

export const PublicHome = () => {
  const { data = [], isLoading } = useQuery<Listing[]>({
    queryKey: ['public-listings'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/public/listings`);
      if (!res.ok) throw new Error('No se pudo cargar la cartera.');
      return res.json();
    },
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [tipo, setTipo] = useState('');
  const [zona, setZona] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [ambientes, setAmbientes] = useState('');

  const tipos = useMemo(() => Array.from(new Set(data.map((p) => p.type).filter(Boolean))).sort(), [data]);
  const zonas = useMemo(() => {
    const seen = new Map<string, string>();
    data.forEach((p) => {
      const z = (p.neighborhood || p.city || '').trim();
      if (z) seen.set(z.toLowerCase(), z);
    });
    return Array.from(seen.values()).sort();
  }, [data]);

  const filtered = useMemo(
    () => data.filter((p) => {
      if (tipo && p.type !== tipo) return false;
      if (zona && (p.neighborhood || p.city || '').toLowerCase() !== zona.toLowerCase()) return false;
      if (precioMax && p.price > Number(precioMax)) return false;
      if (ambientes && (p.rooms || 0) < Number(ambientes)) return false;
      return true;
    }),
    [data, tipo, zona, precioMax, ambientes],
  );
  const clear = () => { setTipo(''); setZona(''); setPrecioMax(''); setAmbientes(''); };
  // Destacados = propiedades marcadas "En Radar" en VERA OS (activas/reservadas/vendidas visibles).
  const featured = useMemo(() => data.filter((p) => p.radar).slice(0, 6), [data]);

  const stats = useInView<HTMLDivElement>();
  const cProps = useCountUp(data.length || 0, stats.seen);
  const cYears = useCountUp(20, stats.seen);
  const cOps = useCountUp(500, stats.seen);
  const cClients = useCountUp(1200, stats.seen);

  const nav = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="vh-root" data-testid="public-home">
      {/* NAV */}
      <header className="vh-nav" data-testid="home-nav">
        <div className="vh-nav__inner">
          <a href="#top" className="vh-nav__brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <img src={LOGO} alt="Varela Inmobiliaria" />
          </a>
          <nav className={`vh-nav__links ${menuOpen ? 'is-open' : ''}`}>
            <button type="button" onClick={() => nav('cartera')} data-testid="nav-propiedades">Propiedades</button>
            <a className="vh-nav__rentals" href={ALQUILERES_URL} target="_blank" rel="noreferrer" data-testid="nav-alquileres"><Umbrella size={15} /> Alquileres</a>
            <Link to="/tasar" onClick={() => setMenuOpen(false)} data-testid="nav-tasar">Tasar</Link>
            <button type="button" onClick={() => nav('nosotros')} data-testid="nav-nosotros">Nosotros</button>
            <button type="button" onClick={() => nav('contacto')} data-testid="nav-contacto">Contacto</button>
            <a className="vh-btn vh-btn--brand vh-nav__cta" href={wa(WA_VENTAS, 'Hola Varela Inmobiliaria, quiero consultar')} target="_blank" rel="noreferrer" data-testid="nav-wa">
              <MessageCircle size={16} /> WhatsApp
            </a>
          </nav>
          <button type="button" className="vh-nav__burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menú" data-testid="nav-burger">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="vh-hero" id="top">
        <div className="vh-hero__bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="vh-hero__scrim" />
        <div className="vh-hero__inner">
          <span className="vh-eyebrow" data-testid="hero-eyebrow">La inmobiliaria del futuro · Costa del Este</span>
          <h1 className="vh-h1">Tecnología real.<br /> Para propietarios <em>reales.</em></h1>
          <p className="vh-hero__sub">Portal del Propietario · IA 24 hs · Tasación gratuita · Radar Inmobiliario</p>
          <div className="vh-hero__cta">
            <button type="button" className="vh-btn vh-btn--brand" onClick={() => nav('cartera')} data-testid="hero-ver">
              Ver propiedades <ArrowRight size={18} />
            </button>
            <a className="vh-btn vh-btn--ghost" href={wa(WA_VENTAS, 'Hola Varela Inmobiliaria, quiero consultar')} target="_blank" rel="noreferrer" data-testid="hero-wa">
              <MessageCircle size={18} /> Hablar por WhatsApp
            </a>
            <Link className="vh-btn vh-btn--ghost" to="/tasar" data-testid="hero-tasar">Tasar mi propiedad</Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="vh-stats" ref={stats.ref} data-testid="home-stats">
        <div className="vh-stats__inner">
          <div className="vh-stat"><span className="vh-stat__n">{cProps}</span><span className="vh-stat__l">Propiedades</span></div>
          <div className="vh-stat"><span className="vh-stat__n">{cYears}</span><span className="vh-stat__l">Años en Costa del Este</span></div>
          <div className="vh-stat"><span className="vh-stat__n">+{cOps}</span><span className="vh-stat__l">Operaciones</span></div>
          <div className="vh-stat"><span className="vh-stat__n">+{cClients}</span><span className="vh-stat__l">Clientes</span></div>
        </div>
      </div>

      {/* ALQUILERES DE VERANO — acceso destacado al subdominio */}
      <section className="vh-rentals" data-testid="home-rentals">
        <div className="vh-rentals__bg" style={{ backgroundImage: `url(${RENTALS_BG})` }} />
        <div className="vh-rentals__scrim" />
        <div className="vh-rentals__inner">
          <span className="vh-eyebrow"><Umbrella size={13} /> Temporada de verano</span>
          <h2 className="vh-h2">Alquileres Temporarios<br /> <em>en Costa del Este</em></h2>
          <p className="vh-rentals__sub">Casas y departamentos frente al mar, entre los pinos. Mirá disponibilidad, fotos y reservá 100% online.</p>
          <a className="vh-btn vh-btn--brand vh-rentals__cta" href={ALQUILERES_URL} target="_blank" rel="noreferrer" data-testid="rentals-cta">
            <Umbrella size={18} /> Ver alquileres de verano <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* RADAR / DESTACADOS */}
      {featured.length > 0 && (
        <section className="vh-sec">
          <div className="vh-sec__inner">
            <span className="vh-eyebrow"><Radar size={13} /> Radar Inmobiliario</span>
            <div className="vh-sec__head">
              <h2 className="vh-h2">Destacados de la semana</h2>
              <button type="button" className="vh-link" onClick={() => nav('cartera')} data-testid="destacados-verall">Ver toda la cartera <ArrowRight size={15} /></button>
            </div>
            <div className="vh-grid">{featured.map((p) => <PropCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}

      {/* CONOCÉ A SEBASTIÁN */}
      <section className="vh-sec vh-sec--bio" id="nosotros">
        <div className="vh-sec__inner vh-bio">
          <div className="vh-bio__media">
            <img src={SEBASTIAN} alt="Sebastián Varela" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="vh-bio__text">
            <span className="vh-eyebrow">Quién te atiende</span>
            <h2 className="vh-h2">Conocé a <em>Sebastián</em></h2>
            <p className="vh-bio__role">Agente Inmobiliario · Varela Inmobiliaria</p>
            <p className="vh-body">20 años viviendo y trabajando en Costa del Este. Conozco cada calle, cada zona, cada obra nueva.</p>
            <p className="vh-bio__legal">Martillero Público · Jorge Varela · T°III F°103 N°865</p>
            <div className="vh-bio__cta">
              <a className="vh-btn vh-btn--brand" href={wa(WA_VENTAS, 'Hola Sebastián, te escribo desde la web')} target="_blank" rel="noreferrer" data-testid="bio-wa">
                <MessageCircle size={17} /> Hablar por WhatsApp
              </a>
              <button type="button" className="vh-btn vh-btn--ghost" onClick={() => nav('cartera')}>Ver propiedades</button>
            </div>
          </div>
        </div>
      </section>

      {/* POR QUÉ ELEGIRNOS */}
      <section className="vh-sec">
        <div className="vh-sec__inner">
          <span className="vh-eyebrow">¿Por qué elegirnos?</span>
          <h2 className="vh-h2">La inmobiliaria que más conoce la Costa</h2>
          <div className="vh-feats">
            {[
              { i: <MapPinned size={22} />, t: '20 años en la zona', d: 'Dos décadas viviendo y trabajando en Costa del Este. Conocemos cada rincón.' },
              { i: <Handshake size={22} />, t: 'Atención personalizada', d: 'Te acompañamos en cada paso con un asesor dedicado y disponible siempre.' },
              { i: <ShieldCheck size={22} />, t: 'Tasaciones precisas', d: 'Análisis de mercado real y comparables actualizados para el mejor valor.' },
              { i: <Sparkles size={22} />, t: 'Tecnología + Confianza', d: 'Herramientas de última generación y la experiencia de siempre, a tu favor.' },
            ].map((f) => (
              <div className="vh-feat" key={f.t}>
                <span className="vh-feat__ic">{f.i}</span>
                <h3 className="vh-feat__t">{f.t}</h3>
                <p className="vh-feat__d">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORTAL DEL PROPIETARIO */}
      <section className="vh-sec">
        <div className="vh-sec__inner vh-portal">
          <div className="vh-portal__head">
            <span className="vh-eyebrow">Exclusivo para propietarios</span>
            <h2 className="vh-h2">Tu propiedad, <em>en tiempo real</em></h2>
            <p className="vh-body">Accedé a información actualizada al instante y tomá decisiones inteligentes con datos reales de tu propiedad.</p>
            <a className="vh-btn vh-btn--brand" href={PORTAL_URL} target="_blank" rel="noreferrer" data-testid="portal-cta">Accedé a tu portal <ArrowRight size={17} /></a>
            <span className="vh-portal__note">Solo para propietarios con propiedad en comercialización</span>
          </div>
          <div className="vh-portal__grid">
            {[
              { i: <Gauge size={20} />, t: 'Termómetro de venta', d: 'Monitoreá el interés y la demanda en tiempo real para tu tipo de propiedad y zona.' },
              { i: <Bot size={20} />, t: 'Actividad de Vera', d: 'Nuestra IA trabaja 24/7 buscando compradores ideales para tu propiedad.' },
              { i: <MessagesSquare size={20} />, t: 'Feedback de visitas', d: 'Recibí opiniones reales de cada visita para acelerar la decisión.' },
              { i: <Radar size={20} />, t: 'Dónde está publicada', d: 'Conocé en qué portales y redes está activa tu propiedad y su rendimiento.' },
            ].map((f) => (
              <div className="vh-portal__card" key={f.t}>
                <span className="vh-portal__ic">{f.i}</span>
                <div><h4>{f.t}</h4><p>{f.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CARTERA ACTIVA */}
      <section className="vh-sec" id="cartera">
        <div className="vh-sec__inner">
          <span className="vh-eyebrow">Cartera activa</span>
          <h2 className="vh-h2">Todas las propiedades</h2>
          <div className="vh-filters" data-testid="home-filters">
            <label className="vh-filter"><span>Tipo</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} data-testid="home-filter-tipo">
                <option value="">Todos</option>{tipos.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
              </select>
            </label>
            <label className="vh-filter"><span>Zona</span>
              <select value={zona} onChange={(e) => setZona(e.target.value)} data-testid="home-filter-zona">
                <option value="">Todas</option>{zonas.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
            <label className="vh-filter"><span>Precio máximo</span>
              <select value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} data-testid="home-filter-precio">
                <option value="">Sin límite</option>{PRICE_STEPS.map((p) => <option key={p} value={p}>{`Hasta US$ ${p.toLocaleString('es-AR')}`}</option>)}
              </select>
            </label>
            <label className="vh-filter"><span>Ambientes</span>
              <select value={ambientes} onChange={(e) => setAmbientes(e.target.value)} data-testid="home-filter-ambientes">
                <option value="">Todos</option>{ROOM_STEPS.map((r) => <option key={r} value={r}>{`${r}+`}</option>)}
              </select>
            </label>
            <button type="button" className="vh-filter__clear" onClick={clear} data-testid="home-filter-clear">Limpiar</button>
          </div>
          <p className="vh-found" data-testid="home-count">{filtered.length} propiedades encontradas</p>
          {isLoading ? (
            <p className="vh-empty">Cargando propiedades…</p>
          ) : filtered.length === 0 ? (
            <p className="vh-empty" data-testid="home-empty">No hay propiedades que coincidan con tu búsqueda.</p>
          ) : (
            <div className="vh-grid">{filtered.map((p) => <PropCard key={p.id} p={p} />)}</div>
          )}
        </div>
      </section>

      {/* RESEÑAS DE GOOGLE */}
      {REVIEWS.length > 0 && (
        <section className="vh-sec vh-sec--reviews">
          <div className="vh-sec__inner">
            <span className="vh-eyebrow"><Star size={13} fill="#F6E63A" color="#F6E63A" /> Reseñas de Google</span>
            <div className="vh-sec__head">
              <div>
                <h2 className="vh-h2">Lo que dicen nuestros clientes</h2>
                <div className="vh-rev-badge" data-testid="reviews-badge">
                  <span className="vh-rev-badge__score">{GOOGLE_RATING.toFixed(1)}</span>
                  <Stars n={GOOGLE_RATING} />
                  <span className="vh-rev-badge__meta">en Google{GOOGLE_TOTAL ? ` · ${GOOGLE_TOTAL} reseñas` : ''}</span>
                </div>
              </div>
              <a className="vh-link" href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" data-testid="reviews-all">Ver todas en Google <ArrowRight size={15} /></a>
            </div>
            <div className="vh-reviews" data-testid="home-reviews">
              {REVIEWS.map((r, i) => (
                <article className="vh-review" key={i} data-testid={`review-${i}`}>
                  <Quote className="vh-review__quote" size={26} />
                  <Stars n={r.rating} />
                  <p className="vh-review__text">{r.text}</p>
                  <div className="vh-review__foot">
                    <span className="vh-review__avatar">{r.name.charAt(0)}</span>
                    <span className="vh-review__meta"><strong>{r.name}</strong>{r.when && <small>{r.when}</small>}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="vh-reviews__cta">
              <a className="vh-btn vh-btn--brand" href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" data-testid="reviews-leave">
                <Star size={17} /> Dejanos tu reseña
              </a>
            </div>
          </div>
        </section>
      )}

      {/* CONTACTO */}
      <section className="vh-sec vh-sec--contact" id="contacto">
        <div className="vh-sec__inner">
          <span className="vh-eyebrow">Contacto</span>
          <h2 className="vh-h2">Hablemos de tu próxima propiedad</h2>
          <p className="vh-body vh-contact__lead">Ya sea que busques comprar, vender, alquilar o invertir, estamos para ayudarte. Escribinos por WhatsApp.</p>
          <div className="vh-contact">
            <a className="vh-contact__wa" href={wa(WA_VENTAS, 'Hola Varela, quiero consultar por una venta')} target="_blank" rel="noreferrer" data-testid="contact-wa-ventas">
              <span className="vh-contact__ic"><MessageCircle size={26} /></span>
              <span className="vh-contact__meta"><small>WhatsApp Ventas</small><strong>+54 9 2246 58-6030</strong></span>
              <ArrowRight size={18} className="vh-contact__arrow" />
            </a>
            <a className="vh-contact__wa" href={wa(WA_ALQUILERES, 'Hola Varela, quiero consultar por un alquiler')} target="_blank" rel="noreferrer" data-testid="contact-wa-alquileres">
              <span className="vh-contact__ic"><MessageCircle size={26} /></span>
              <span className="vh-contact__meta"><small>WhatsApp Alquileres</small><strong>+54 9 2257 40-4000</strong></span>
              <ArrowRight size={18} className="vh-contact__arrow" />
            </a>
          </div>
          <div className="vh-contact__info">
            <span><MapPin size={15} /> Costa del Este · Mar del Tuyú</span>
            <a href="mailto:varelavendecde@gmail.com"><Mail size={15} /> varelavendecde@gmail.com</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="vh-footer">
        <div className="vh-footer__inner">
          <div className="vh-footer__brand">
            <img src={LOGO} alt="Varela Inmobiliaria" />
            <p>Inmobiliaria en Costa del Este y Mar del Tuyú.</p>
          </div>
          <div className="vh-footer__links">
            <button type="button" onClick={() => nav('cartera')}>Propiedades</button>
            <Link to="/tasar">Tasar mi propiedad</Link>
            <button type="button" onClick={() => nav('nosotros')}>Nosotros</button>
            <a href={wa(WA_VENTAS, 'Hola Varela, quiero consultar')} target="_blank" rel="noreferrer">WhatsApp Ventas</a>
            <a href={wa(WA_ALQUILERES, 'Hola Varela, quiero consultar por un alquiler')} target="_blank" rel="noreferrer">WhatsApp Alquileres</a>
          </div>
          <div className="vh-footer__legal">
            <span>Martillero Público · Jorge Varela · T°III F°103 N°865</span>
            <span>© {new Date().getFullYear()} Varela Inmobiliaria · Impulsado por VERA OS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicHome;
