import { X, Download, MessageCircle } from 'lucide-react';
import { Button } from '@vera/ui';

/** Vista previa de un PDF dentro de la app (iframe) + descargar y enviar por WhatsApp. */
export const DocPreview = ({ title, previewUrl, downloadUrl, waHref, onClose }: {
  title: string; previewUrl: string; downloadUrl: string; waHref?: string; onClose: () => void;
}) => (
  <div className="rt-modal" data-testid="rt-docpreview" onClick={onClose}>
    <div className="rt-modal__box rt-modal__box--doc" onClick={(e) => e.stopPropagation()}>
      <div className="rt-modal__head">
        <h3>{title}</h3>
        <button type="button" onClick={onClose} data-testid="rt-docpreview-close"><X size={18} /></button>
      </div>
      <iframe className="rt-docframe" src={previewUrl} title={title} data-testid="rt-docframe" />
      <div className="rt-modal__foot">
        {waHref && (
          <a className="rt-mini rt-mini--wa" href={waHref} target="_blank" rel="noreferrer" data-testid="rt-docpreview-wa">
            <MessageCircle size={14} /> Enviar por WhatsApp
          </a>
        )}
        <a href={downloadUrl} target="_blank" rel="noreferrer" data-testid="rt-docpreview-download">
          <Button variant="primary" size="md"><Download size={15} /> Descargar PDF</Button>
        </a>
      </div>
    </div>
  </div>
);
