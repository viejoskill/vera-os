import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Bath, Maximize, MapPin, Ruler, Compass, MessageCircle, Share2, Check } from 'lucide-react';
import { env } from '@vera/config';
import { logInquiry } from './whatsappInquiry';
import { usePageMeta, SITE_URL } from './usePageMeta';
import { InstagramReel } from './InstagramReel';
import { PropertyMap } from './PropertyMap';

interface Img { id: string; url: string; }
interface Detail {
  id: string; code: string; title: string; type: string; operation: string;
  price: number; currency: string; address: string; city: string; neighborhood: string;
  province: string; description: string; bedrooms: number; bathrooms: number; rooms: number;
  areaM2: number; lotAreaM2: number; orientation: string; condition: string;
  amenities: string[]; images: Img[]; coverImage: string; status: string; videoUrl?: string;
  whatsappUrl: string; publicUrl: string; autoStamp?: boolean;
  latitude?: number | null; longitude?: number | null;
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
  const [shared, setShared] = useState(false);

  // Link de compartir con vista previa por propiedad (foto + título reales). Pega el
  // endpoint server-side /share que WhatsApp/redes SÍ leen (los crawlers no ejecutan JS).
  const shareLink = `${env.backendUrl}/api/properties/${id}/share`;
  const onShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: data?.title, url: shareLink }); return; } catch { /* cancelado */ }
    }
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareLink; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    setShared(true);
    window.setTimeout(() => setShared(false), 2200);
  };

  // Open Graph / Twitter / SEO: reflejamos los metadatos desde la fuente de verdad
  // de VERA (título, descripción, foto, URL canónica) + JSON-LD RealEstateListing.
  const desc = (data?.description || '').replace(/\s+/g, ' ').trim();
  const shortDesc = data
    ? `${data.operation} en ${[data.neighborhood, data.city].filter(Boolean).join(', ')}. ${money(data.price, data.currency)}. ${desc}`.slice(0, 160)
    : 'Ficha de propiedad — Varela Inmobiliaria, Costa del Este y Mar del Tuyú.';
  const image = data?.coverImage || data?.images?.[0]?.url || '';
  // Canonical siempre en el dominio propio (/web/{id}), nunca la URL vieja de otro sistema.
  const canonicalUrl = `${SITE_URL}/web/${id}`;

  usePageMeta({
    title: data ? `${data.title} · Varela Propiedades` : 'Propiedad · Varela Propiedades',
    description: shortDesc,
    canonical: canonicalUrl,
    ogImage: image,
    jsonLd: data
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            name: data.title,
            description: shortDesc,
            url: canonicalUrl,
            image: image ? [image] : undefined,
            address: {
              '@type': 'PostalAddress',
              streetAddress: data.address,
              addressLocality: data.city,
              addressRegion: data.province,
              addressCountry: 'AR',
            },
            offers: {
              '@type': 'Offer',
              price: data.price,
              priceCurrency: data.currency,
              availability:
                data.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Cartera', item: `${SITE_URL}/web` },
              { '@type': 'ListItem', position: 3, name: data.title, item: canonicalUrl },
            ],
          },
        ]
      : undefined,
  });

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
        <button type="button" className="vera-pub__share" onClick={onShare} data-testid="public-detail-share">
          {shared ? <><Check size={15} /> Link copiado</> : <><Share2 size={15} /> Compartir</>}
        </button>
      </header>

      <div className="vera-pub-detail">
        <div className="vera-pub-detail__gallery">
          {main ? <img className="vera-pub-detail__main" src={main} alt={data.title} data-testid="public-detail-main-image" /> : <div className="vera-pub-card__noimg" />}
          {data.autoStamp !== false && data.status === 'sold' && <span className="vera-pub-stamp vera-pub-stamp--sold vera-pub-stamp--lg">VENDIDA</span>}
          {data.autoStamp !== false && data.status === 'reserved' && <span className="vera-pub-stamp vera-pub-stamp--reserved vera-pub-stamp--lg">RESERVADA</span>}
          {gallery.length > 1 && (
            <div className="vera-pub-detail__thumbs">
              {gallery.map((g, i) => (
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

        {(typeof data.latitude === 'number' && typeof data.longitude === 'number') || data.videoUrl ? (
          <div className="vera-pub-detail__side">
            {typeof data.latitude === 'number' && typeof data.longitude === 'number' && (
              <PropertyMap
                latitude={data.latitude}
                longitude={data.longitude}
                operation={data.operation}
                address={[data.address, data.neighborhood, data.city].filter(Boolean).join(', ')}
              />
            )}
            {data.videoUrl && (
              <div className="vera-pub-detail__reel" data-testid="public-detail-reel">
                <h2 className="vera-pub-detail__h2">Video</h2>
                <InstagramReel url={data.videoUrl} />
              </div>
            )}
          </div>
        ) : null}

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
