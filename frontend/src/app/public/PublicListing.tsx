import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BedDouble, Bath, Maximize, MapPin, MessageCircle } from 'lucide-react';
import { env } from '@vera/config';
import { openWhatsAppInquiry } from './whatsappInquiry';
import { usePageMeta, SITE_URL } from './usePageMeta';

interface Listing {
  id: string;
  code: string;
  title: string;
  type: string;
  operation: string;
  price: number;
  currency: string;
  city: string;
  neighborhood: string;
  coverImage: string;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  lotAreaM2: number;
  rooms: number;
  status: string;
  whatsappUrl: string;
  publicUrl: string;
  autoStamp?: boolean;
}

const money = (n: number, c: string) =>
  n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar';

const STAMP: Record<string, { label: string; cls: string }> = {
  sold: { label: 'VENDIDA', cls: 'vera-pub-stamp--sold' },
  reserved: { label: 'RESERVADA', cls: 'vera-pub-stamp--reserved' },
};

const PRICE_STEPS = [50000, 100000, 150000, 200000, 300000, 500000, 1000000];
const ROOM_STEPS = ['1', '2', '3', '4', '5'];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Vista pública de VERA — lee EN VIVO la cartera. Muestra también Vendidas/Reservadas
 * (con sello) para transmitir que Varela vende. Filtros públicos para interesados. */
export const PublicListing = () => {
  const { data = [], isLoading } = useQuery<Listing[]>({
    queryKey: ['public-listings'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/public/listings`);
      if (!res.ok) throw new Error('No se pudo cargar la cartera.');
      return res.json();
    },
  });

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
    () =>
      data.filter((p) => {
        if (tipo && p.type !== tipo) return false;
        if (zona && (p.neighborhood || p.city || '').toLowerCase() !== zona.toLowerCase()) return false;
        if (precioMax && p.price > Number(precioMax)) return false;
        if (ambientes) {
          const min = Number(ambientes);
          if ((p.rooms || 0) < min) return false;
        }
        return true;
      }),
    [data, tipo, zona, precioMax, ambientes],
  );

  const clear = () => {
    setTipo('');
    setZona('');
    setPrecioMax('');
    setAmbientes('');
  };

  usePageMeta({
    title: 'Propiedades en venta y alquiler en Costa del Este | Varela',
    description: 'Casas, lotes, PH y departamentos disponibles en Costa del Este y Mar del Tuyú. Filtrá por tipo, zona y precio.',
    canonical: `${SITE_URL}/web`,
  });

  return (
    <div className="vera-pub" data-testid="public-listing">
      <header className="vera-pub__topbar">
        <Link to="/" data-testid="listing-logo-home">
          <img src="/varela-logo-brand.png" alt="Varela Inmobiliaria" style={{ height: 34, width: 'auto', display: 'block' }} />
        </Link>
        <span className="vera-pub__count">{data.length} propiedades</span>
      </header>

      <div className="vera-pub__hero">
        <h1 className="vera-pub__h1">Encontrá tu próxima propiedad</h1>
        <p className="vera-pub__sub">Cartera actualizada en tiempo real.</p>
      </div>

      <div className="vera-pub__filters" data-testid="public-filters">
        <label className="vera-pub__filter">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} data-testid="filter-tipo">
            <option value="">Todos</option>
            {tipos.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
        </label>
        <label className="vera-pub__filter">
          <span>Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)} data-testid="filter-zona">
            <option value="">Todas</option>
            {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className="vera-pub__filter">
          <span>Precio máximo</span>
          <select value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} data-testid="filter-precio">
            <option value="">Sin límite</option>
            {PRICE_STEPS.map((p) => <option key={p} value={p}>US$ {p.toLocaleString('es-AR')}</option>)}
          </select>
        </label>
        <label className="vera-pub__filter">
          <span>Ambientes</span>
          <select value={ambientes} onChange={(e) => setAmbientes(e.target.value)} data-testid="filter-ambientes">
            <option value="">Todos</option>
            {ROOM_STEPS.map((r) => <option key={r} value={r}>{r === '5' ? '5+' : r}</option>)}
          </select>
        </label>
        <button type="button" className="vera-pub__clear" onClick={clear} data-testid="filter-clear">Limpiar</button>
      </div>

      <p className="vera-pub__found" data-testid="public-count">{filtered.length} propiedades encontradas</p>

      {isLoading ? (
        <p className="vera-pub__empty">Cargando propiedades…</p>
      ) : filtered.length === 0 ? (
        <p className="vera-pub__empty" data-testid="public-empty">No hay propiedades que coincidan con tu búsqueda.</p>
      ) : (
        <div className="vera-pub__grid">
          {filtered.map((p) => {
            const stamp = p.autoStamp === false ? undefined : STAMP[p.status];
            return (
              <Link key={p.id} to={`/web/${p.id}`} className="vera-pub-card" data-testid={`public-card-${p.id}`}>
                <div className="vera-pub-card__media">
                  {p.coverImage ? (
                    <img src={p.coverImage} alt={p.title} loading="lazy" />
                  ) : (
                    <div className="vera-pub-card__noimg" />
                  )}
                  <span className="vera-pub-card__op">{p.operation}</span>
                  {stamp && <span className={`vera-pub-stamp ${stamp.cls}`} data-testid={`stamp-${p.id}`}>{stamp.label}</span>}
                </div>
                <div className="vera-pub-card__body">
                  <span className="vera-pub-card__price">{money(p.price, p.currency)}</span>
                  <h3 className="vera-pub-card__title">{p.title}</h3>
                  <span className="vera-pub-card__loc"><MapPin size={13} /> {[p.neighborhood, p.city].filter(Boolean).join(', ')}</span>
                  <div className="vera-pub-card__specs">
                    {p.bedrooms > 0 && <span><BedDouble size={14} /> {p.bedrooms}</span>}
                    {p.bathrooms > 0 && <span><Bath size={14} /> {p.bathrooms}</span>}
                    {(p.areaM2 > 0 || p.lotAreaM2 > 0) && (
                      <span><Maximize size={14} /> {p.areaM2 || p.lotAreaM2} m²</span>
                    )}
                  </div>
                  <span className="vera-pub-card__code">{p.code}</span>
                  {p.status !== 'sold' && p.whatsappUrl && (
                    <button
                      type="button"
                      className="vera-wa-btn vera-wa-btn--sm"
                      data-testid={`public-card-whatsapp-${p.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openWhatsAppInquiry(p.id, p.whatsappUrl);
                      }}
                    >
                      <MessageCircle size={15} /> Consultar por WhatsApp
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <footer className="vera-pub__footer">Publicado con VERA OS</footer>
    </div>
  );
};

export default PublicListing;
