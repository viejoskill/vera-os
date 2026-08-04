import { useEffect, useRef, useState } from 'react';
import { Share2, Link2, ImageDown, Smartphone, ChevronDown } from 'lucide-react';
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
    /* fallback */
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\nFoto: ${url}`)}`, '_blank');
}

/** Menú unificado de compartir: link de la ficha (con miniatura correcta), foto con
 *  sello, historia 9:16 y compartir foto directo. Agrupado para no ensuciar el panel. */
export const ShareMenu = ({ propertyId, status, title, address }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const base = `${env.backendUrl}/api/properties/${propertyId}`;
  const shareUrl = `${base}/share`;
  const coverUrl = `${base}/stamped-cover?status=${status}`;
  const storyUrl = `${base}/story?status=${status}`;
  const stampable = status === 'sold' || status === 'reserved';
  const text = [title, address].filter(Boolean).join('\n');

  const shareLink = async () => {
    setOpen(false);
    const nav = navigator as Navigator & {
      share?: (d: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    try {
      if (nav.share) {
        await nav.share({ title, text, url: shareUrl });
        return;
      }
    } catch {
      /* fallback */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\nVer la ficha: ${shareUrl}`)}`, '_blank');
  };

  return (
    <div className="vera-sharemenu" ref={ref}>
      <button
        type="button"
        className="vera-stamp-share"
        onClick={() => setOpen((o) => !o)}
        data-testid="share-menu-trigger"
      >
        <Share2 size={15} /> Compartir <ChevronDown size={14} />
      </button>
      {open && (
        <div className="vera-sharemenu__panel" data-testid="share-menu-panel">
          <button type="button" className="vera-sharemenu__item" onClick={shareLink} data-testid="share-listing">
            <Link2 size={15} /> Compartir ficha
          </button>
          {stampable && (
            <a className="vera-sharemenu__item" href={coverUrl} target="_blank" rel="noreferrer"
               onClick={() => setOpen(false)} data-testid="download-stamped-cover">
              <ImageDown size={15} /> Foto con sello
            </a>
          )}
          {stampable && (
            <a className="vera-sharemenu__item" href={storyUrl} target="_blank" rel="noreferrer"
               onClick={() => setOpen(false)} data-testid="download-story">
              <Smartphone size={15} /> Historia (9:16)
            </a>
          )}
          {stampable && (
            <button type="button" className="vera-sharemenu__item"
                    onClick={() => { setOpen(false); shareImage(coverUrl, `varela-${status}.jpg`, title, text); }}
                    data-testid="share-stamped-cover">
              <Share2 size={15} /> Compartir foto
            </button>
          )}
        </div>
      )}
    </div>
  );
};
