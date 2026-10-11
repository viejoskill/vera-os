import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import { env } from '@vera/config';
import { DARK_MAP_STYLE, mapPinIcon } from './googleMapTheme';

interface Props {
  latitude: number;
  longitude: number;
  operation: string;
  address?: string;
}

/** Mapa de ubicación de UNA propiedad en su ficha pública. Solo lectura (sin
 * autocompletado ni drag), con link "Cómo llegar" a Google Maps externo. */
export const PropertyMap = ({ latitude, longitude, operation, address }: Props) => {
  if (!env.googleMapsApiKey) return null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className="vera-pub-detail__mapwrap" data-testid="public-detail-map">
      <div className="vera-pub-detail__maphead">
        <h2 className="vera-pub-detail__h2">Ubicación</h2>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" data-testid="public-detail-map-directions">
          <MapPin size={13} /> Cómo llegar
        </a>
      </div>
      <div className="vera-pub-detail__map">
        <APIProvider apiKey={env.googleMapsApiKey}>
          <Map
            defaultCenter={{ lat: latitude, lng: longitude }}
            defaultZoom={15}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            styles={DARK_MAP_STYLE}
            style={{ width: '100%', height: '100%' }}
          >
            <Marker
              position={{ lat: latitude, lng: longitude }}
              icon={mapPinIcon(operation === 'alquiler' ? '#5FD6C0' : '#F6E63A')}
            />
          </Map>
        </APIProvider>
      </div>
      {address && <span className="vera-pub-detail__mapaddr">{address}</span>}
    </div>
  );
};

export default PropertyMap;
