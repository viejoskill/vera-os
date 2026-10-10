import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import { env } from '@vera/config';

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

// Estilo nocturno de Google Maps, en línea con el tema oscuro de la web pública.
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1c1c1c' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1c1c' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#161616' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2e2e2e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

const pinIcon = (color: string) => ({
  url:
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="#0e0f13" stroke-width="2.5"/><circle cx="15" cy="15" r="5.5" fill="#0e0f13"/></svg>`,
    ),
  scaledSize: typeof window !== 'undefined' && window.google ? new window.google.maps.Size(30, 40) : undefined,
  anchor: typeof window !== 'undefined' && window.google ? new window.google.maps.Point(15, 40) : undefined,
});

const MapaInner = ({ listings }: { listings: MapListing[] }) => {
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
      styles={DARK_STYLE}
      style={{ width: '100%', height: '100%' }}
    >
      {listings.map((p) => (
        <Marker
          key={p.id}
          position={{ lat: p.latitude as number, lng: p.longitude as number }}
          icon={pinIcon(p.operation === 'alquiler' ? '#5FD6C0' : '#F6E63A')}
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
              <Link to={`/web/${active.id}`} className="vera-map-popup__cta" data-testid={`map-popup-cta-${active.id}`}>
                Ver propiedad
              </Link>
            </div>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};

/** Vista en mapa, embebida como alternativa de "/web" ("Ver en mapa"). Recibe la
 * MISMA lista ya filtrada por PublicListing, así los filtros (tipo/zona/precio/
 * ambientes) aplican igual en ambas vistas. Usa Google Maps (API key ya configurada
 * en LocationSection), sin pedir ninguna credencial nueva. */
export const ListingsMap = ({ listings }: { listings: MapListing[] }) => {
  const withCoords = useMemo(
    () => listings.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number'),
    [listings],
  );

  return (
    <div className="vera-map-canvas" data-testid="listings-map-canvas">
      {env.googleMapsApiKey ? (
        withCoords.length > 0 ? (
          <APIProvider apiKey={env.googleMapsApiKey}>
            <MapaInner listings={withCoords} />
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
