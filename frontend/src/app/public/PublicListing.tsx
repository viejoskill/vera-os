import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BedDouble, Bath, Maximize, MapPin } from 'lucide-react';
import { env } from '@vera/config';

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
}

const money = (n: number, c: string) =>
  n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar';

/** Vista pública de VERA — lee EN VIVO la cartera publicada en Web. Sin login. */
export const PublicListing = () => {
  const { data = [], isLoading } = useQuery<Listing[]>({
    queryKey: ['public-listings'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/public/listings`);
      if (!res.ok) throw new Error('No se pudo cargar la cartera.');
      return res.json();
    },
  });

  return (
    <div className="vera-pub" data-testid="public-listing">
      <header className="vera-pub__topbar">
        <span className="vera-pub__brand">VARELA<span>PROPIEDADES</span></span>
        <span className="vera-pub__count">{data.length} propiedades disponibles</span>
      </header>

      <div className="vera-pub__hero">
        <h1 className="vera-pub__h1">Encontrá tu próxima propiedad</h1>
        <p className="vera-pub__sub">Cartera actualizada en tiempo real.</p>
      </div>

      {isLoading ? (
        <p className="vera-pub__empty">Cargando propiedades…</p>
      ) : data.length === 0 ? (
        <p className="vera-pub__empty" data-testid="public-empty">No hay propiedades publicadas por el momento.</p>
      ) : (
        <div className="vera-pub__grid">
          {data.map((p) => (
            <Link key={p.id} to={`/web/${p.id}`} className="vera-pub-card" data-testid={`public-card-${p.id}`}>
              <div className="vera-pub-card__media">
                {p.coverImage ? (
                  <img src={p.coverImage} alt={p.title} loading="lazy" />
                ) : (
                  <div className="vera-pub-card__noimg" />
                )}
                <span className="vera-pub-card__op">{p.operation}</span>
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
              </div>
            </Link>
          ))}
        </div>
      )}

      <footer className="vera-pub__footer">Publicado con VERA OS</footer>
    </div>
  );
};

export default PublicListing;
