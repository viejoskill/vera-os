import { Sparkles, ExternalLink } from 'lucide-react';
import { useAuth } from '@app/auth/AuthProvider';

/** VERA Studio — herramienta de contenido para redes, embebida en el OS.
 *  Es un HTML autocontenido (public/vera-studio.html). Le pasamos el id del
 *  usuario logueado (?u=) para que su estado (identidad, logo, plan del mes) se
 *  sincronice en el backend de VERA y lo siga entre dispositivos. */
export const StudioScreen = () => {
  const { session } = useAuth();
  const uid = session?.user?.id ?? '';
  const src = `/vera-studio.html${uid ? `?u=${encodeURIComponent(uid)}` : ''}`;

  return (
    <div className="vera-studio" data-testid="studio-screen">
      <div className="vera-studio__bar">
        <div className="vera-studio__title">
          <Sparkles size={18} /> VERA Studio
          <span className="vera-studio__sub">Contenido de redes · sincronizado con tu cuenta</span>
        </div>
        <a
          className="vera-studio__open"
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="studio-open-tab"
        >
          <ExternalLink size={15} /> Abrir en pestaña
        </a>
      </div>
      <iframe
        src={src}
        title="VERA Studio"
        className="vera-studio__frame"
        allow="clipboard-read; clipboard-write; fullscreen"
        data-testid="studio-iframe"
      />
    </div>
  );
};

export default StudioScreen;
