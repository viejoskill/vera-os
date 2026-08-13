import { env } from '@vera/config';

export const RENTALS_API = `${env.backendUrl}/api/rentals`;

export interface RentalImage { id: string; url: string; isCover: boolean; }
export interface RentalProperty {
  id: string; slug: string; codigo?: string; titulo: string; direccion?: string; localidad?: string;
  descripcion?: string; capacidad: number; dormitorios: number; banos: number;
  amenities: string[]; moneda: string; precioNoche: number; activa: boolean;
  imagenes: RentalImage[];
  descSemana?: number; descQuincena?: number; descMes?: number;
  comisionPct?: number; comisionMinima?: number; notas?: string;
  propietario?: { nombre?: string; telefono?: string; email?: string; dni?: string; observaciones?: string };
  ocupados?: Occupied[]; descuentos?: { semana: number; quincena: number; mes: number };
}
export interface Movimiento {
  id: string; propertyId: string; fecha: string; tipo: string; monto: number;
  descripcion?: string; reservaId?: string; createdAt?: string;
}
export interface Liquidacion {
  propiedad: { id: string; codigo?: string; titulo: string; moneda: string };
  propietario: { nombre?: string; telefono?: string; email?: string; dni?: string };
  periodo: { desde: string; hasta: string };
  ingresos: number; comision: number; gastosPropietario: number; gastosNuestros: number;
  netoPropietario: number; movimientos: Movimiento[];
}
export const TIPO_MOV: Record<string, string> = {
  ingreso: 'Seña / Ingreso', gasto_prop: 'Gasto propietario', gasto_nuestro: 'Gasto agencia', comision: 'Comisión',
};
export interface SaleProperty {
  id: string; titulo: string; direccion: string; localidad: string;
  dormitorios: number; banos: number; fotos: number; cover: string;
}
export interface Occupied { checkIn: string; checkOut: string; estado?: string; }
export interface Reservation {
  id: string; propertyId: string; propertyTitulo?: string; estado: string;
  checkIn: string; checkOut: string; noches: number; montoEstimado: number; moneda: string;
  origen?: string; motivo?: string; createdAt?: string;
  huesped: { nombre?: string; telefono?: string; email?: string; dni?: string; huespedes?: number; comentario?: string };
}

const json = async (r: Response) => {
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `Error ${r.status}`);
  }
  return r.status === 204 ? null : r.json();
};

export const api = {
  listProperties: (): Promise<RentalProperty[]> => fetch(`${RENTALS_API}/properties`).then(json),
  getProperty: (id: string): Promise<RentalProperty> => fetch(`${RENTALS_API}/properties/${id}`).then(json),
  createProperty: (body: Partial<RentalProperty>): Promise<RentalProperty> =>
    fetch(`${RENTALS_API}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
  updateProperty: (id: string, body: Partial<RentalProperty>): Promise<RentalProperty> =>
    fetch(`${RENTALS_API}/properties/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
  deleteProperty: (id: string) => fetch(`${RENTALS_API}/properties/${id}`, { method: 'DELETE' }).then(json),
  saleProperties: (query?: string): Promise<SaleProperty[]> =>
    fetch(`${RENTALS_API}/sale-properties${query ? `?query=${encodeURIComponent(query)}` : ''}`).then(json),
  importSale: (saleId: string): Promise<RentalProperty> =>
    fetch(`${RENTALS_API}/import/${saleId}`, { method: 'POST' }).then(json),
  uploadImage: (id: string, file: File): Promise<RentalImage> => {
    const fd = new FormData(); fd.append('file', file);
    return fetch(`${RENTALS_API}/properties/${id}/images`, { method: 'POST', body: fd }).then(json);
  },
  deleteImage: (id: string, imgId: string) => fetch(`${RENTALS_API}/properties/${id}/images/${imgId}`, { method: 'DELETE' }).then(json),
  listReservations: (propertyId?: string, estado?: string): Promise<Reservation[]> => {
    const q = new URLSearchParams(); if (propertyId) q.set('propertyId', propertyId); if (estado) q.set('estado', estado);
    return fetch(`${RENTALS_API}/reservations?${q}`).then(json);
  },
  createReservation: (body: Record<string, unknown>): Promise<Reservation> =>
    fetch(`${RENTALS_API}/reservations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
  createBlock: (body: Record<string, unknown>): Promise<Reservation> =>
    fetch(`${RENTALS_API}/blocks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
  setStatus: (rid: string, estado: string, motivo?: string): Promise<Reservation> =>
    fetch(`${RENTALS_API}/reservations/${rid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado, motivo }) }).then(json),
  deleteReservation: (rid: string) => fetch(`${RENTALS_API}/reservations/${rid}`, { method: 'DELETE' }).then(json),
  listMovimientos: (pid: string): Promise<Movimiento[]> => fetch(`${RENTALS_API}/properties/${pid}/movimientos`).then(json),
  createMovimiento: (body: Record<string, unknown>): Promise<Movimiento> =>
    fetch(`${RENTALS_API}/movimientos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
  deleteMovimiento: (mid: string) => fetch(`${RENTALS_API}/movimientos/${mid}`, { method: 'DELETE' }).then(json),
  liquidacion: (propertyId: string, desde: string, hasta: string): Promise<Liquidacion> =>
    fetch(`${RENTALS_API}/liquidacion?propertyId=${propertyId}&desde=${desde}&hasta=${hasta}`).then(json),
  // Público
  publicList: (): Promise<RentalProperty[]> => fetch(`${RENTALS_API}/public/properties`).then(json),
  publicProperty: (slug: string): Promise<RentalProperty> => fetch(`${RENTALS_API}/public/properties/${slug}`).then(json),
  quote: (slug: string, checkIn: string, checkOut: string) =>
    fetch(`${RENTALS_API}/public/quote?slug=${slug}&checkIn=${checkIn}&checkOut=${checkOut}`).then(json),
  prereserva: (slug: string, body: Record<string, unknown>) =>
    fetch(`${RENTALS_API}/public/properties/${slug}/prereserva`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
};

// ---- utils ----
export const fmtMoney = (n: number, moneda = 'ARS') => {
  const s = Math.round(n || 0).toLocaleString('es-AR');
  return moneda === 'USD' ? `USD ${s}` : `$ ${s}`;
};
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const nightsBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

export const ESTADOS: Record<string, { label: string; cls: string }> = {
  prereserva: { label: 'Pre-reserva', cls: 'rt-b--warn' },
  confirmada: { label: 'Confirmada', cls: 'rt-b--ok' },
  encurso: { label: 'En curso', cls: 'rt-b--info' },
  finalizada: { label: 'Finalizada', cls: 'rt-b--muted' },
  cancelada: { label: 'Cancelada', cls: 'rt-b--danger' },
  bloqueo: { label: 'Bloqueo', cls: 'rt-b--muted' },
};
