import { useQuery } from '@tanstack/react-query';

/** Cotizaciones del dólar en vivo — DolarApi (Argentina). Sin API key, CORS ok. */
export interface DolarQuote {
  label: string;
  compra: number;
  venta: number;
}

interface DolarApiItem {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
}

const WANTED: { casa: string; label: string }[] = [
  { casa: 'oficial', label: 'Dólar Oficial' },
  { casa: 'blue', label: 'Dólar Blue' },
  { casa: 'bolsa', label: 'Dólar MEP' },
];

const fetchDolar = async (): Promise<DolarQuote[]> => {
  const res = await fetch('https://dolarapi.com/v1/dolares');
  if (!res.ok) throw new Error('dolar fetch failed');
  const data: DolarApiItem[] = await res.json();
  return WANTED.map(({ casa, label }) => {
    const item = data.find((d) => d.casa === casa);
    return { label, compra: item?.compra ?? 0, venta: item?.venta ?? 0 };
  });
};

export const useDolar = () =>
  useQuery({
    queryKey: ['market', 'dolar'],
    queryFn: fetchDolar,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
