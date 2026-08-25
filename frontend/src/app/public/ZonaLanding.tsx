import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BedDouble, Bath, Maximize, MapPin, MessageCircle, ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { env } from '@vera/config';
import { openWhatsAppInquiry } from './whatsappInquiry';
import { usePageMeta, SITE_URL } from './usePageMeta';
import { LandingConfig, LANDING_LIST, LANDINGS } from './landingConfigs';

interface Listing {
  id: string; code: string; title: string; type: string; operation: string;
  price: number; currency: string; city: string; neighborhood: string; coverImage: string;
  bedrooms: number; bathrooms: number; areaM2: number; lotAreaM2: number; rooms: number;
  status: string; whatsappUrl: string;
  autoStamp?: boolean;
  hasVideo?: boolean;
}

const money = (n: number, c: string) =>
  n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar';

const STAMP: Record<string, { label: string; cls: string }> = {
  sold: { label: 'VENDIDA', cls: 'vera-pub-stamp--sold' },
  reserved: { label: 'RESERVADA', cls: 'vera-pub-stamp--reserved' },
};

const isCDE = (c: string) => (c || '').trim().toLowerCase() === 'costa del este';

/** Landing por zona/tipo para SEO local. Reusa la cartera en vivo filtrada por tipo,
 *  con H1 + copy únicos, meta/canonical propios y JSON-LD CollectionPage + Breadcrumb. */
export const ZonaLanding = ({ config }: { config: LandingConfig }) => {
  const { data = [], isLoading } = useQuery<Listing[]>({
    queryKey: ['public-listings'],
    queryFn: async () => {
      const res = await fetch(`${env.backendUrl}/api/public/listings`);
      if (!res.ok) throw new Error('No se pudo cargar la cartera.');
      return res.json();
    },
  });

  const items = useMemo(
    () => data.filter((p) => (config.type ? p.type === config.type && isCDE(p.city) : true)),
    [data, config.type],
  );

  const canonical = `${SITE_URL}${config.slug}`;
  const breadcrumb = config.isHub
    ? [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
       { '@type': 'ListItem', position: 2, name: config.h1, item: canonical }]
    : [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
       { '@type': 'ListItem', position: 2, name: 'Propiedades en venta en Costa del Este', item: `${SITE_URL}${LANDINGS.hub.slug}` },
       { '@type': 'ListItem', position: 3, name: config.h1, item: canonical }];

  usePageMeta({
    title: config.title,
    description: config.description,
    canonical,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: config.h1,
        description: config.description,
        url: canonical,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/web/${p.id}`,
            name: p.title,
          })),
        },
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumb },
    ],
  });

  return (
    <div className="vera-pub" data-testid={`zona-landing${config.type ? '-' + config.type : '-hub'}`}>
      <header className="vera-pub__topbar">
        <Link to="/" className="vera-pub__back"><ArrowLeft size={16} /> Inicio</Link>
        <Link to="/web" className="vera-pub__back">Ver toda la cartera <ArrowRight size={16} /></Link>
      </header>

      <div className="vera-pub__hero">
        <h1 className="vera-pub__h1" data-testid="zona-h1">{config.h1}</h1>
        {config.intro.map((p, i) => (
          <p key={i} className="vera-lp__intro">{p}</p>
        ))}
      </div>

      {config.isHub && (
        <nav className="vera-lp__types" aria-label="Explorar por tipo">
          {LANDING_LIST.map((l) => (
            <Link key={l.slug} to={l.slug} className="vera-lp__typelink" data-testid={`hub-type-${l.type}`}>
              {l.h1.replace(' en Costa del Este', '')} <ArrowRight size={15} />
            </Link>
          ))}
          <Link to="/alquileres" className="vera-lp__typelink vera-lp__typelink--alt" data-testid="hub-alquileres">
            Alquileres temporarios <ArrowRight size={15} />
          </Link>
        </nav>
      )}

      <p className="vera-pub__found" data-testid="zona-count">{items.length} propiedades disponibles</p>

      {isLoading ? (
        <p className="vera-pub__empty">Cargando propiedades…</p>
      ) : items.length === 0 ? (
        <p className="vera-pub__empty" data-testid="zona-empty">{config.emptyMsg}</p>
      ) : (
        <div className="vera-pub__grid">
          {items.map((p) => {
            const stamp = p.autoStamp === false ? undefined : STAMP[p.status];
            return (
              <Link key={p.id} to={`/web/${p.id}`} className="vera-pub-card" data-testid={`zona-card-${p.id}`}>
                <div className="vera-pub-card__media">
                  {p.coverImage ? <img src={p.coverImage} alt={p.title} loading="lazy" /> : <div className="vera-pub-card__noimg" />}
                  <span className="vera-pub-card__op">{p.operation}</span>
                  {p.hasVideo && <span className="vera-pub-card__video"><Play size={11} /> Video</span>}
                  {stamp && <span className={`vera-pub-stamp ${stamp.cls}`}>{stamp.label}</span>}
                </div>
                <div className="vera-pub-card__body">
                  <span className="vera-pub-card__price">{money(p.price, p.currency)}</span>
                  <h3 className="vera-pub-card__title">{p.title}</h3>
                  <span className="vera-pub-card__loc"><MapPin size={13} /> {[p.neighborhood, p.city].filter(Boolean).join(', ')}</span>
                  <div className="vera-pub-card__specs">
                    {p.bedrooms > 0 && <span><BedDouble size={14} /> {p.bedrooms}</span>}
                    {p.bathrooms > 0 && <span><Bath size={14} /> {p.bathrooms}</span>}
                    {(p.areaM2 > 0 || p.lotAreaM2 > 0) && <span><Maximize size={14} /> {p.areaM2 || p.lotAreaM2} m²</span>}
                  </div>
                  <span className="vera-pub-card__code">{p.code}</span>
                  {p.status !== 'sold' && p.whatsappUrl && (
                    <button
                      type="button"
                      className="vera-wa-btn vera-wa-btn--sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWhatsAppInquiry(p.id, p.whatsappUrl); }}
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

      {!config.isHub && (
        <div className="vera-lp__hublink">
          <Link to={LANDINGS.hub.slug} className="vera-lp__typelink">
            Ver todas las propiedades en venta en Costa del Este <ArrowRight size={15} />
          </Link>
        </div>
      )}

      <footer className="vera-pub__footer">Publicado con VERA OS</footer>
    </div>
  );
};

export default ZonaLanding;
