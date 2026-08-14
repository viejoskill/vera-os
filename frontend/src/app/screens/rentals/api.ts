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
  ropaBlanca?: boolean; aceptaMascotas?: boolean; depositoGarantia?: number;
  checkInHora?: string; checkOutHora?: string; estadiaMinima?: number; condiciones?: string[];
  ocupados?: Occupied[]; descuentos?: { semana: number; quincena: number; mes: number };
}
export interface RentalSettings { condicionesGenerales: string[]; avisoValidez: string; }
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
export interface LiquidacionReserva extends Liquidacion {
  reserva: { id: string; checkIn: string; checkOut: string; noches: number };
  huesped: { nombre?: string; telefono?: string; dni?: string };
  pago: Pago;
  alquiler: number;
}
export const TIPO_MOV: Record<string, string> = {
  ingreso: 'Seña / Ingreso', gasto_prop: 'Gasto propietario', gasto_nuestro: 'Gasto agencia', comision: 'Comisión',
};
export interface SaleProperty {
  id: string; titulo: string; direccion: string; localidad: string;
  dormitorios: number; banos: number; fotos: number; cover: string;
}
export interface Occupied { checkIn: string; checkOut: string; estado?: string; }
export interface Pago {
  proveedor?: string; monto?: number; moneda?: string; estado?: string;
  preferenceId?: string; initPoint?: string; paymentId?: string; mpStatus?: string;
  creadoEl?: string; pagadoEl?: string | null;
}
export interface Reservation {
  id: string; propertyId: string; propertyTitulo?: string; estado: string;
  checkIn: string; checkOut: string; noches: number; montoEstimado: number; moneda: string;
  origen?: string; motivo?: string; createdAt?: string; pago?: Pago | null;
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
  liquidacionPdfUrl: (propertyId: string, desde: string, hasta: string): string =>
    `${RENTALS_API}/liquidacion/pdf?propertyId=${propertyId}&desde=${desde}&hasta=${hasta}`,
  reciboSenaUrl: (rid: string): string => `${RENTALS_API}/reservations/${rid}/recibo-sena`,
  liquidables: (pid: string): Promise<Reservation[]> => fetch(`${RENTALS_API}/properties/${pid}/liquidables`).then(json),
  liquidacionReserva: (rid: string): Promise<LiquidacionReserva> => fetch(`${RENTALS_API}/reservations/${rid}/liquidacion`).then(json),
  liquidacionReservaPdfUrl: (rid: string): string => `${RENTALS_API}/reservations/${rid}/liquidacion/pdf`,
  paymentLink: (rid: string, monto: number, descripcion?: string): Promise<{ initPoint: string; preferenceId: string; monto: number }> =>
    fetch(`${RENTALS_API}/reservations/${rid}/payment-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto, descripcion }) }).then(json),
  getReservation: (rid: string): Promise<Reservation> => fetch(`${RENTALS_API}/reservations/${rid}`).then(json),
  calendar: (pid: string): Promise<{ ocupados: Occupied[] }> => fetch(`${RENTALS_API}/properties/${pid}/calendar`).then(json),
  getSettings: (): Promise<RentalSettings> => fetch(`${RENTALS_API}/settings`).then(json),
  updateSettings: (body: RentalSettings): Promise<RentalSettings> =>
    fetch(`${RENTALS_API}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json),
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

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' (día/mes/año). Deja el valor si no matchea. */
export const fmtDate = (s?: string | null): string => {
  if (!s || typeof s !== 'string') return '';
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[2]}/${p[1]}/${p[0]}`;
};

/** Link wa.me con mensaje pre-escrito (click-to-send desde el WhatsApp del usuario). */
export const waLink = (telefono: string, mensaje: string): string => {
  const num = (telefono || '').replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
};

/** Mensaje al huésped con datos de la reserva y (si existe) el link de seña. */
export const mensajeReserva = (r: Reservation): string => {
  if (r.estado === 'cancelada') return mensajeRechazo(r, r.motivo);
  const nombre = r.huesped?.nombre?.split(' ')[0] || '';
  const l: string[] = [];
  l.push(`¡Hola ${nombre}! 👋 Te escribimos de Inmobiliaria Varela por tu reserva de ${r.propertyTitulo || 'la propiedad'}.`);
  l.push('');
  l.push(`📅 ${fmtDate(r.checkIn)} al ${fmtDate(r.checkOut)} (${r.noches} noches)`);
  l.push(`💰 Total estimado: ${fmtMoney(r.montoEstimado, r.moneda)}`);
  if (r.pago?.initPoint && r.pago.estado !== 'pagado') {
    l.push('');
    l.push(`Para confirmar la reserva necesitamos la seña de ${fmtMoney(r.pago.monto || 0, 'ARS')}. Podés abonarla de forma segura desde este link:`);
    l.push(r.pago.initPoint);
  } else if (r.pago?.estado === 'pagado') {
    l.push('');
    l.push('✅ Ya recibimos tu seña. ¡Tu reserva quedó confirmada!');
  } else {
    l.push('');
    l.push('En breve te enviamos los datos para abonar la seña y confirmar la reserva.');
  }
  l.push('');
  l.push('¡Muchas gracias! 🌴');
  return l.join('\n');
};

/** Mensaje de rechazo de una pre-reserva (con motivo opcional). */
export const mensajeRechazo = (r: Reservation, motivo?: string): string => {
  const nombre = r.huesped?.nombre?.split(' ')[0] || '';
  const l: string[] = [];
  l.push(`¡Hola ${nombre}! 👋 Te escribimos de Inmobiliaria Varela por tu solicitud de reserva de ${r.propertyTitulo || 'la propiedad'}.`);
  l.push('');
  l.push(`📅 ${fmtDate(r.checkIn)} al ${fmtDate(r.checkOut)} (${r.noches} noches)`);
  l.push('');
  l.push(motivo ? `Lamentablemente no podemos confirmar esta reserva: ${motivo}` : 'Lamentablemente no podemos confirmar esta reserva para esas fechas.');
  l.push('');
  l.push('Si querés, escribinos y buscamos juntos otras fechas o propiedades disponibles. ¡Gracias por contactarnos! 🌴');
  return l.join('\n');
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

/** Estado mostrado con la lógica estricta de pago: confirmada = esperando seña hasta que se pague. */
export const displayEstado = (r: Reservation): { label: string; cls: string } => {
  if (r.estado === 'confirmada') {
    if (r.pago?.estado === 'pagado') return { label: 'Reservada · seña pagada', cls: 'rt-b--ok' };
    return { label: 'Esperando seña', cls: 'rt-b--wait' };
  }
  return ESTADOS[r.estado] || { label: r.estado, cls: 'rt-b--muted' };
};

export const esEsperandoSena = (r: Reservation) => r.estado === 'confirmada' && r.pago?.estado !== 'pagado';
