import { useEffect, useRef } from 'react';
import { APIProvider, Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { env } from '@vera/config';
import { DARK_MAP_STYLE, mapPinIcon } from '@app/public/googleMapTheme';

interface Props {
  address: string;
  onAddressChange: (v: string) => void;
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

const AutocompleteInput = ({ address, onAddressChange, onLocationChange }: Omit<Props, 'latitude' | 'longitude'>) => {
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address'],
      types: ['address'],
      componentRestrictions: { country: 'ar' },
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      onAddressChange(place.formatted_address || inputRef.current?.value || '');
      onLocationChange(loc.lat(), loc.lng());
    });
    return () => listener.remove();
  }, [places, onAddressChange, onLocationChange]);

  return (
    <label className="rt-field"><span>Dirección</span>
      <input
        ref={inputRef}
        defaultValue={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Escribí la dirección y elegí una sugerencia…"
        data-testid="rt-direccion"
      />
    </label>
  );
};

/** Campo de dirección con autocompletado de Google Places para propiedades de
 * alquiler. Al elegir una sugerencia, guarda lat/lng automáticamente — sin
 * necesidad de arrastrar ningún pin a mano. */
export const RentalLocationField = ({ address, onAddressChange, latitude, longitude, onLocationChange }: Props) => {
  if (!env.googleMapsApiKey) {
    return (
      <label className="rt-field"><span>Dirección</span>
        <input value={address} onChange={(e) => onAddressChange(e.target.value)} data-testid="rt-direccion" />
      </label>
    );
  }

  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <APIProvider apiKey={env.googleMapsApiKey} libraries={['places']}>
      <div className="rt-ws__location">
        <AutocompleteInput address={address} onAddressChange={onAddressChange} onLocationChange={onLocationChange} />
        {hasCoords && (
          <div className="rt-ws__locationmap" data-testid="rt-location-preview">
            <Map
              defaultCenter={{ lat: latitude as number, lng: longitude as number }}
              defaultZoom={15}
              gestureHandling="greedy"
              disableDefaultUI
              styles={DARK_MAP_STYLE}
              style={{ width: '100%', height: '100%' }}
            >
              <Marker position={{ lat: latitude as number, lng: longitude as number }} icon={mapPinIcon('#5FD6C0')} />
            </Map>
          </div>
        )}
      </div>
    </APIProvider>
  );
};

export default RentalLocationField;
