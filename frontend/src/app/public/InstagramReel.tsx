import { useEffect, useRef } from 'react';

/**
 * Embed oficial de Instagram: muestra la portada real del reel + play, y al tocar
 * lo reproduce / abre en Instagram. Solo pegando el link del reel.
 */
export const InstagramReel = ({ url }: { url: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const clean = (url || '').split('?')[0].replace(/\/$/, '');

  useEffect(() => {
    const process = () => (window as unknown as { instgrm?: any }).instgrm?.Embeds?.process();
    const w = window as unknown as { instgrm?: any };
    if (w.instgrm) {
      process();
      return;
    }
    if (!document.getElementById('ig-embed-script')) {
      const s = document.createElement('script');
      s.id = 'ig-embed-script';
      s.async = true;
      s.src = 'https://www.instagram.com/embed.js';
      s.onload = process;
      document.body.appendChild(s);
    } else {
      const t = window.setTimeout(process, 800);
      return () => window.clearTimeout(t);
    }
  }, [clean]);

  if (!clean) return null;
  const isIG = /instagram\.com/.test(clean);

  if (!isIG) {
    // Fallback: cualquier otro link de video → botón que abre en pestaña nueva.
    return (
      <a href={clean} target="_blank" rel="noreferrer" className="vera-reel-link" data-testid="reel-external">
        ▶ Ver video
      </a>
    );
  }

  return (
    <div ref={ref} className="vera-reel" data-testid="instagram-reel">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`${clean}/`}
        data-instgrm-version="14"
        style={{ background: '#000', border: 0, borderRadius: 12, margin: '0 auto', maxWidth: 420, width: '100%' }}
      />
    </div>
  );
};
