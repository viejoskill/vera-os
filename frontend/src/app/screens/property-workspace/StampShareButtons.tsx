import { ImageDown, Share2 } from 'lucide-react';
import { env } from '@vera/config';

interface Props {
  propertyId: string;
  status: string;
  title: string;
  address?: string;
}

/** Botones para la portada con sello: descargar y compartir directo.
 *  El compartir usa el share nativo (en móvil abre WhatsApp con la imagen adjunta);
 *  si no está disponible (desktop), abre WhatsApp con el texto + link a la imagen. */
export const StampShareButtons = ({ propertyId, status, title, address }: Props) => {
  const url = `${env.backendUrl}/api/properties/${propertyId}/stamped-cover?status=${status}`;
  const estado = status === 'sold' ? 'VENDIDA' : 'RESERVADA';
  const text = [title, address].filter(Boolean).join('\n');

  const share = async () => {
    const nav = navigator as Navigator & {
      canShare?: (d: { files?: File[] }) => boolean;
      share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `varela-${estado.toLowerCase()}.jpg`, { type: 'image/jpeg' });
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text });
        return;
      }
    } catch {
      /* si el usuario cancela o no soporta archivos, caemos al link de WhatsApp */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\nFoto: ${url}`)}`, '_blank');
  };

  return (
    <>
      <a
        className="vera-stamp-dl"
        href={url}
        target="_blank"
        rel="noreferrer"
        data-testid="download-stamped-cover"
        title="Descargar la portada con el sello"
      >
        <ImageDown size={15} /> Foto con sello
      </a>
      <button
        type="button"
        className="vera-stamp-share"
        onClick={share}
        data-testid="share-stamped-cover"
        title="Compartir la foto con sello (WhatsApp)"
      >
        <Share2 size={15} /> Compartir
      </button>
    </>
  );
};
