import { Link2 } from 'lucide-react';

interface Props {
  url: string;
  title: string;
  price?: number;
  currency?: string;
}

/** Comparte el LINK de la ficha pública (varelapropiedadescde.com.ar). En móvil usa el
 *  share nativo; en desktop abre WhatsApp Web con el mensaje + link. */
export const ShareListingButton = ({ url, title, price, currency }: Props) => {
  const precio = price ? `\n${currency || 'USD'} ${price.toLocaleString('es-AR')}` : '';
  const text = `${title}${precio}\n\nVer la ficha completa:`;

  const share = async () => {
    const nav = navigator as Navigator & {
      share?: (d: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    try {
      if (nav.share) {
        await nav.share({ title, text, url });
        return;
      }
    } catch {
      /* fallback WhatsApp */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
  };

  return (
    <button type="button" className="vera-stamp-share" onClick={share}
            data-testid="share-listing" title="Compartir el link de la ficha pública">
      <Link2 size={15} /> Compartir ficha
    </button>
  );
};
