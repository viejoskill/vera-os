import { env } from '@vera/config';

/**
 * Primer punto de contacto entre el sitio público y el ecosistema VERA.
 * Registra el evento "Website Property Inquiry" (base para Arturito) sin bloquear
 * la apertura de WhatsApp, y abre el deep link con el contexto de la propiedad.
 */
export const logInquiry = (propertyId: string) => {
  try {
    fetch(`${env.backendUrl}/api/public/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* no-op: el registro es best-effort */
  }
};

/** Abre WhatsApp (app en mobile, web en desktop) y registra la consulta. */
export const openWhatsAppInquiry = (propertyId: string, whatsappUrl: string) => {
  logInquiry(propertyId);
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
};
