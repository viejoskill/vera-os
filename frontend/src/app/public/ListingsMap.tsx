import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import { env } from '@vera/config';
import { DARK_MAP_STYLE, mapPinIcon } from './googleMapTheme';

interface MapListing {
  id: string;
  title: string;
  operation: string;
  price: number;
  currency: string;
  city: string;
  neighborhood: string;
  coverImage: string;
  latitude?: number | null;
  longitude?: number | null;
}

const money = (n: number, c: string) =>
  n ? `${c === 'USD' ? 'US$' : '$'} ${n.toLocaleString('es-AR')}` : 'Consultar';

const MapaInner = ({ listings, getHref }: { listings: MapListing[]; getHref: (id: string) => string }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const center = useMemo(() => {
    if (listings.length === 0) return { lat: -36.59, lng: -56.68 };
    const lat = listings.reduce((a, p) => a + (p.latitude as number), 0) / listings.length;
    const lng = listings.reduce((a, p) => a + (p.longitude as number), 0) / listings.length;
    return { lat, lng };
  }, [listings]);

  const active = listings.find((p) => p.id === activeId) || null;

  return (
    <Map
      defaultCenter={center}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      styles={DARK_MAP_STYLE}
      style={{ width: '100%', height: '100%' }}
    >
      {listings.map((p) => (
        <Marker
          key={p.id}
          position={{ lat: p.latitude as number, lng: p.longitude as number }}
          icon={mapPinIcon(p.operation === 'alquiler' ? '#5FD6C0' : '#F6E63A')}
          onClick={() => setActiveId(p.id)}
        />
      ))}

      {active && (
        <InfoWindow
          position={{ lat: active.latitude as number, lng: active.longitude as number }}
          onCloseClick={() => setActiveId(null)}
          pixelOffset={[0, -36]}
        >
          <div className="vera-map-popup" data-testid={`map-popup-${active.id}`}>
            <div className="vera-map-popup__media">
              {active.coverImage ? (
                <img src={active.coverImage} alt={active.title} />
              ) : (
                <div className="vera-map-popup__noimg"><MapPin size={20} /></div>
              )}
            </div>
            <div className="vera-map-popup__body">
              <span className="vera-map-popup__price">{money(active.price, active.currency)}</span>
              <h3 className="vera-map-popup__title">{active.title}</h3>
              <span className="vera-map-popup__loc">{[active.neighborhood, active.city].filter(Boolean).join(', ')}</span>
              <Link to={getHref(active.id)} className="vera-map-popup__cta" data-testid={`map-popup-cta-${active.id}`}>
                Ver propiedad
              </Link>
            </div>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};

/** Vista en mapa, embebida como alternativa a la grilla de listado ("Ver en mapa"),
 * reutilizada tanto en /web (Ventas) como en /alquileres (Alquileres). Recibe la
 * MISMA lista ya filtrada por el caller, así los filtros aplican igual en ambas
 * vistas. `getHref` resuelve el link "Ver propiedad" según la sección (Ventas usa
 * /web/{id}, Alquileres usa /reservar/{slug}). Usa Google Maps (API key ya
 * configurada en LocationSection), sin pedir ninguna credencial nueva. */
export const ListingsMap = ({ listings, getHref = (id) => `/web/${id}` }: { listings: MapListing[]; getHref?: (id: string) => string }) => {
  const withCoords = useMemo(
    () => listings.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number'),
    [listings],
  );

  return (
    <div className="vera-map-canvas" data-testid="listings-map-canvas">
      {env.googleMapsApiKey ? (
        withCoords.length > 0 ? (
          <APIProvider apiKey={env.googleMapsApiKey}>
            <MapaInner listings={withCoords} getHref={getHref} />
          </APIProvider>
        ) : (
          <p className="vera-pub__empty" data-testid="map-empty">Ninguna de estas propiedades tiene ubicación cargada todavía.</p>
        )
      ) : (
        <p className="vera-pub__empty">El mapa se activa al configurar Google Maps.</p>
      )}
    </div>
  );
};

export default ListingsMap;
