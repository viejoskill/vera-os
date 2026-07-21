import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Bath, Maximize, MapPin, Ruler, Compass, MessageCircle } from 'lucide-react';
import { env } from '@vera/config';
import { logInquiry } from './whatsappInquiry';

interface Img { id: string; url: string; }
interface Detail {
  id: string; code: string; title: string; type: string; operation: string;
  price: number; currency: string; address: string; city: string; neighborhood: string;
  province: string; description: string; bedrooms: number; bathrooms: number; rooms: number;
  areaM2: number; lotAreaM2: number; orientation: string; condition: string;
  amenities: string[]; images: Img[]; coverImage: string; status: string;
  whatsappUrl: string; publicUrl: string;
}

const money = (n: number, c: string) =>
  n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar';

const AI_IMAGE_DISCLAIMER =
  'Algunas imágenes de esta publicación pueden haber sido optimizadas digitalmente mediante inteligencia artificial con fines ilustrativos, con el objetivo de mostrar el potencial de la propiedad. Las características reales deberán verificarse durante la visita.';

/** Ficha pública de una propiedad (sin login, sin datos privados). */
export const PublicPropertyDetail = () => {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery<Detail>({
    queryKey: ['public-listing', id],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/public/listings/${id}`);
      if (!res.ok) throw new Error('not found');
      return res.json();
    },
    enabled: !!id,
    retry: false,
  });
  const [active, setActive] = useState(0);

  if (isLoading) return <div className="vera-pub"><p className="vera-pub__empty">Cargando…</p></div>;

  if (isError || !data) {
    return (
      <div className="vera-pub">
        <div className="vera-pub__empty" data-testid="public-detail-notfound">
          <p>Esta propiedad ya no está disponible.</p>
          <Link to="/web" className="vera-pub__back"><ArrowLeft size={16} /> Volver a la cartera</Link>
        </div>
      </div>
    );
  }

  const gallery = data.images.length ? data.images : (data.coverImage ? [{ id: 'c', url: data.coverImage }] : []);
  const main = gallery[active]?.url || data.coverImage;
  const specs = [
    data.rooms > 0 && { icon: Maximize, label: `${data.rooms} amb.` },
    data.bedrooms > 0 && { icon: BedDouble, label: `${data.bedrooms} dorm.` },
    data.bathrooms > 0 && { icon: Bath, label: `${data.bathrooms} baños` },
    data.areaM2 > 0 && { icon: Ruler, label: `${data.areaM2} m² cub.` },
    data.lotAreaM2 > 0 && { icon: Maximize, label: `${data.lotAreaM2} m² tot.` },
    data.orientation && { icon: Compass, label: data.orientation },
  ].filter(Boolean) as { icon: typeof Maximize; label: string }[];

  return (
    <div className="vera-pub" data-testid="public-detail">
      <header className="vera-pub__topbar">
        <Link to="/web" className="vera-pub__back"><ArrowLeft size={16} /> Cartera</Link>
        <span className="vera-pub__brand">VARELA<span>PROPIEDADES</span></span>
      </header>

      <div className="vera-pub-detail">
        <div className="vera-pub-detail__gallery">
          {main ? <img className="vera-pub-detail__main" src={main} alt={data.title} data-testid="public-detail-main-image" /> : <div className="vera-pub-card__noimg" />}
          {data.status === 'sold' && <span className="vera-pub-stamp vera-pub-stamp--sold vera-pub-stamp--lg">VENDIDA</span>}
          {data.status === 'reserved' && <span className="vera-pub-stamp vera-pub-stamp--reserved vera-pub-stamp--lg">RESERVADA</span>}
          {gallery.length > 1 && (
            <div className="vera-pub-detail__thumbs">
              {gallery.slice(0, 8).map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  className={`vera-pub-detail__thumb ${i === active ? 'vera-pub-detail__thumb--active' : ''}`.trim()}
                  onClick={() => setActive(i)}
                >
                  <img src={g.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="vera-pub-detail__info">
          <span className="vera-pub-card__op">{data.operation}</span>
          <span className="vera-pub-detail__price">{money(data.price, data.currency)}</span>
          <h1 className="vera-pub-detail__title">{data.title}</h1>
          <span className="vera-pub-card__loc"><MapPin size={14} /> {[data.address, data.neighborhood, data.city].filter(Boolean).join(', ')}</span>
          <div className="vera-pub-detail__specs">
            {specs.map((s, i) => {
              const Icon = s.icon;
              return <span key={i}><Icon size={15} /> {s.label}</span>;
            })}
          </div>
          {data.status !== 'sold' && data.whatsappUrl && (
            <a
              className="vera-wa-btn"
              href={data.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logInquiry(data.id)}
              data-testid="public-detail-whatsapp"
            >
              <MessageCircle size={18} /> Consultar por WhatsApp
            </a>
          )}
          <span className="vera-pub-card__code">{data.code}</span>
        </aside>
      </div>

      <section className="vera-pub-detail__section">
        {data.description && (
          <>
            <h2 className="vera-pub-detail__h2">Descripción</h2>
            <p className="vera-pub-detail__desc">{data.description}</p>
          </>
        )}
        <p className="vera-pub-detail__disclaimer" data-testid="public-detail-disclaimer">
          {AI_IMAGE_DISCLAIMER}
        </p>
      </section>

      {data.amenities?.length > 0 && (
        <section className="vera-pub-detail__section">
          <h2 className="vera-pub-detail__h2">Amenities</h2>
          <div className="vera-pub-detail__amenities">
            {data.amenities.map((a) => (
              <span key={a} className="vera-pub-detail__amenity">{a.replace(/^amenity-/, '').replace(/-/g, ' ')}</span>
            ))}
          </div>
        </section>
      )}

      <footer className="vera-pub__footer">Publicado con VERA OS</footer>
    </div>
  );
};

export default PublicPropertyDetail;
