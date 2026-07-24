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
}): string {
  const first = (opts.ownerName || '').trim().split(/\s+/)[0];
  const name = first ? ` ${first}` : '';
  const where = opts.address ? ` de ${opts.address}` : '';
  const comment = (opts.comment || '').trim();
  const commentPart = comment ? `\n\nComentario de la visita: ${comment}` : '';
  const signature = opts.agent ? `${opts.agent.trim()} · Inmobiliaria Varela` : 'Inmobiliaria Varela';
  return (
    `Hola${name}, ¿cómo estás? 👋\n\n` +
    `Te cuento que hoy tuvimos una visita en tu propiedad${where} 🏡. ` +
    `Vino un interesado y la mostramos con toda la dedicación de siempre.${commentPart}\n\n` +
    `Seguimos trabajando para encontrar el comprador ideal y te mantenemos al tanto de cada novedad. ` +
    `¡Gracias por la confianza! 🤝\n\n` +
    `${signature}`
  );
}

/** WhatsApp deep link con el mensaje precargado. Limpia el teléfono a solo dígitos. */
export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
