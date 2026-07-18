import { useQuery } from '@tanstack/react-query';

/** Clima actual en vivo — Open-Meteo (sin API key, CORS ok). Default: Buenos Aires. */
export interface Weather {
  temp: number;
  code: number;
  description: string;
  city: string;
}

// WMO weather codes → descripción en español (agrupado).
const describe = (code: number): string => {
  if (code === 0) return 'Despejado';
  if (code <= 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code <= 48) return 'Neblina';
  if (code <= 57) return 'Llovizna';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Chaparrones';
  if (code <= 86) return 'Nevadas';
  return 'Tormenta';
};

const LAT = -34.6037;
const LON = -58.3816;
const CITY = 'Buenos Aires';

const fetchWeather = async (): Promise<Weather> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=America%2FArgentina%2FBuenos_Aires`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed');
  const data = await res.json();
  const code = data?.current?.weather_code ?? 0;
  return {
    temp: Math.round(data?.current?.temperature_2m ?? 0),
    code,
    description: describe(code),
    city: CITY,
  };
};

export const useWeather = () =>
  useQuery({
    queryKey: ['weather', 'buenos-aires'],
    queryFn: fetchWeather,
    refetchInterval: 600_000,
    staleTime: 300_000,
  });
