import { ImageDown, Share2, Smartphone } from 'lucide-react';
import { env } from '@vera/config';

interface Props {
  propertyId: string;
  status: string;
  title: string;
  address?: string;
}

async function shareImage(url: string, filename: string, title: string, text: string) {
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/jpeg' });
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title, text });
      return;
    }
  } catch {
    /* fallback a WhatsApp con link */
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\nFoto: ${url}`)}`, '_blank');
}

/** Botones para la portada con sello: descargar, compartir directo y formato historia. */
export const StampShareButtons = ({ propertyId, status, title, address }: Props) => {
  const base = `${env.backendUrl}/api/properties/${propertyId}`;
  const coverUrl = `${base}/stamped-cover?status=${status}`;
  const storyUrl = `${base}/story?status=${status}`;
  const estado = status === 'sold' ? 'vendida' : 'reservada';
  const text = [title, address].filter(Boolean).join('\n');

  return (
    <>
      <a className="vera-stamp-dl" href={coverUrl} target="_blank" rel="noreferrer"
         data-testid="download-stamped-cover" title="Descargar la portada con el sello">
        <ImageDown size={15} /> Foto con sello
      </a>
      <a className="vera-stamp-dl" href={storyUrl} target="_blank" rel="noreferrer"
         data-testid="download-story" title="Descargar en formato historia (9:16)">
        <Smartphone size={15} /> Historia
      </a>
      <button type="button" className="vera-stamp-share"
              onClick={() => shareImage(coverUrl, `varela-${estado}.jpg`, title, text)}
              data-testid="share-stamped-cover" title="Compartir la foto con sello (WhatsApp)">
        <Share2 size={15} /> Compartir
      </button>
    </>
  );
};
