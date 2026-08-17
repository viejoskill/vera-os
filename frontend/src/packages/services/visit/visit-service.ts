import { env } from '@vera/config';
import type { PropertyVisit, VisitInput } from '@vera/types';

const base = `${env.backendUrl}/api/properties`;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`VERA API ${res.status}`);
  return (await res.json()) as T;
}

/** Seguimiento — visits live inside the property (no separate module). */
export const visitService = {
  list: (propertyId: string) => http<PropertyVisit[]>(`/${propertyId}/visits`),
  create: (propertyId: string, input: VisitInput) =>
    http<PropertyVisit>(`/${propertyId}/visits`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

/** Builds a warm, ready-to-send WhatsApp message for the owner (keeps the buyer anonymous). */
export function buildOwnerMessage(opts: {
  address?: string;
  comment?: string;
  ownerName?: string;
  agent?: string;
  date?: string;
  time?: string;
}): string {
  const owner = (opts.ownerName || '').trim();
  const saludo = owner ? `Estimado/a ${owner}` : 'Estimado/a propietario/a';
  const agent = (opts.agent || '').trim();
  const agentFirst = agent.split(/\s+/)[0];
  const agentName = agentFirst && !agentFirst.includes('@') ? agentFirst : 'Inmobiliaria Varela';
  const where = opts.address ? ` de ${opts.address}` : '';
  const cuando = visitDateLong(opts.date);
  const hora = (opts.time || '').trim();
  const comment = (opts.comment || '').trim();

  const lineas = [
    'Inmobiliaria Varela',
    '',
    `${saludo}, le informamos que ${cuando} hemos realizado una visita a su propiedad${where} junto a un posible comprador.`,
    '',
  ];
  if (hora) lineas.push(`Horario: ${hora} hs`);
  lineas.push(`Agente: ${agentName}`);
  if (comment) { lineas.push(''); lineas.push(comment); }
  lineas.push('');
  lineas.push('Ante cualquier novedad o consulta, nos estaremos comunicando.');
  lineas.push('¡Muchas gracias!');
  lineas.push('');
  lineas.push('_Este es un mensaje automático de Inmobiliaria Varela_');
  return lineas.join('\n');
}

/** Fecha de la visita en formato "el miércoles 1 de julio" (o "hoy, miércoles 1 de julio"). */
function visitDateLong(dateStr?: string): string {
  if (!dateStr) return 'hoy';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'hoy';
  const txt = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return `hoy, ${txt}`;
  return `el ${txt}`;
}

/** WhatsApp deep link con el mensaje precargado. Limpia el teléfono a solo dígitos. */
export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
