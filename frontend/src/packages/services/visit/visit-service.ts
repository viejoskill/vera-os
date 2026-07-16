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

/** Builds a ready-to-paste WhatsApp message for the owner (keeps the buyer anonymous). */
export function buildOwnerMessage(opts: { address: string; comment: string }): string {
  const where = opts.address ? ` ubicada en ${opts.address}` : '';
  const talked = opts.comment ? ` Durante la visita se conversó sobre ${opts.comment.trim()}.` : '';
  return (
    `Hola.\n` +
    `Hoy mostramos tu propiedad${where} a un interesado.${talked}\n` +
    `Seguimos trabajando para encontrar el comprador adecuado y te mantendremos informada de cualquier novedad.`
  );
}
