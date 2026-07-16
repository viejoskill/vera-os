import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import { Input } from '@vera/ui';
import { env } from '@vera/config';
import type { PropertyFormValues } from './form-schema';

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires

const pick = (place: google.maps.places.PlaceResult, types: string[]): string => {
  const c = place.address_components?.find((comp) => types.some((t) => comp.types.includes(t)));
  return c?.long_name ?? '';
};

// Recenters the map when coordinates change (e.g. after selecting an address).
const Recenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.panTo({ lat, lng });
      map.setZoom(16);
    }
  }, [map, lat, lng]);
  return null;
};

const LocationInner = () => {
  const { register, watch, setValue } = useFormContext<PropertyFormValues>();
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const lat = watch('latitude');
  const lng = watch('longitude');
  const neighborhood = watch('neighborhood');
  const city = watch('city');
  const province = watch('province');
  const postalCode = watch('postalCode');

  const addressReg = register('address');

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ['address_components', 'geometry', 'formatted_address', 'place_id'],
      types: ['address'],
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const streetNumber = pick(place, ['street_number']);
      const route = pick(place, ['route']);
      const street = [route, streetNumber].filter(Boolean).join(' ') || place.formatted_address || '';

      setValue('address', street, { shouldValidate: true });
      if (inputRef.current) inputRef.current.value = street;
      setValue('neighborhood', pick(place, ['neighborhood', 'sublocality', 'sublocality_level_1']));
      setValue('city', pick(place, ['locality', 'administrative_area_level_2']) || 'Buenos Aires');
      setValue('province', pick(place, ['administrative_area_level_1']));
      setValue('postalCode', pick(place, ['postal_code']));
      setValue('country', pick(place, ['country']));
      setValue('formattedAddress', place.formatted_address ?? '');
      setValue('googlePlaceId', place.place_id ?? '');
      if (place.geometry?.location) {
        setValue('latitude', place.geometry.location.lat());
        setValue('longitude', place.geometry.location.lng());
      }
    });
    return () => listener.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  const summary = [neighborhood, city, province, postalCode].filter(Boolean).join(' · ');
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';

  return (
    <div className="vera-location">
      <div className="vera-field">
        <label className="vera-field__label" htmlFor="ws-address">Dirección</label>
        <input
          id="ws-address"
          className="vera-input"
          placeholder="Empezá a escribir la dirección…"
          data-testid="input-address"
          name={addressReg.name}
          onBlur={addressReg.onBlur}
          onChange={addressReg.onChange}
          defaultValue={watch('address')}
          ref={(el) => {
            addressReg.ref(el);
            inputRef.current = el;
          }}
        />
      </div>

      {summary && (
        <p className="vera-location__summary" data-testid="location-summary">
          <MapPin size={14} /> {summary}
        </p>
      )}

      {hasCoords ? (
        <div className="vera-location__map" data-testid="location-map">
          <Map
            defaultCenter={{ lat: lat as number, lng: lng as number }}
            defaultZoom={16}
            gestureHandling="greedy"
            disableDefaultUI
            style={{ width: '100%', height: '280px' }}
          >
            <Marker
              position={{ lat: lat as number, lng: lng as number }}
              draggable
              onDragEnd={(e) => {
                if (!e.latLng) return;
                setValue('latitude', e.latLng.lat());
                setValue('longitude', e.latLng.lng());
              }}
            />
            <Recenter lat={lat as number} lng={lng as number} />
          </Map>
        </div>
      ) : (
        <div className="vera-location__empty" data-testid="location-empty">
          <MapPin size={22} />
          <p>Todavía sin ubicación en el mapa.</p>
          <span>Escribí la dirección arriba y VERA la ubica automáticamente.</span>
        </div>
      )}
    </div>
  );
};

/** Smart location: Google Places autocomplete + interactive map. Degrades gracefully. */
export const LocationSection = () => {
  const { register } = useFormContext<PropertyFormValues>();
  const apiKey = env.googleMapsApiKey;

  if (!apiKey) {
    return (
      <div className="vera-form">
        <Input label="Dirección" placeholder="Ej.: Gorriti 4500" data-testid="input-address" {...register('address')} />
        <div className="vera-form-grid">
          <Input label="Barrio" placeholder="Ej.: Palermo Soho" {...register('neighborhood')} />
          <Input label="Ciudad" placeholder="Ej.: Buenos Aires" {...register('city')} />
        </div>
        <p className="vera-muted">El mapa inteligente se activa al configurar Google Maps.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <LocationInner />
    </APIProvider>
  );
};
