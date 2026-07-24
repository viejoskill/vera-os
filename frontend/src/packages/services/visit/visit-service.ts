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
}): string {
  const first = (opts.ownerName || '').trim().split(/\s+/)[0];
  const greeting = first ? `Hola ${first}` : 'Hola';
  const agentFirst = (opts.agent || '').trim().split(/\s+/)[0];
  const agentName = agentFirst && !agentFirst.includes('@') ? agentFirst : 'Inmobiliaria Varela';
  const where = opts.address ? ` de ${opts.address}` : '';
  const comment = (opts.comment || '').trim();
  const commentPart = comment ? `\n\nComentario de la visita: ${comment}` : '';
  const when = visitWhen(opts.date);
  return (
    `${greeting} ¿cómo estás? 👋 Soy Vera, la asistente virtual de ${agentName}\n\n` +
    `Te cuento que ${when} tuvimos una visita en tu propiedad${where} 🏡. ` +
    `Vino un interesado y la mostramos con toda la dedicación de siempre.${commentPart}\n\n` +
    `Seguimos trabajando para encontrar el comprador ideal y te mantenemos al tanto de cada novedad. ` +
    `¡Gracias por la confianza! 🤝`
  );
}

/** "hoy" / "ayer" / "el DD/MM/AAAA" según la fecha de la visita. */
function visitWhen(dateStr?: string): string {
  if (!dateStr) return 'hoy';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'hoy';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `el ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

/** WhatsApp deep link con el mensaje precargado. Limpia el teléfono a solo dígitos. */
export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
