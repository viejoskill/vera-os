import { useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, MessageCircle, Pencil } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  contactName: string;
  initialMessage: string;
  phone?: string;
}

const waLink = (text: string, phone?: string): string => {
  const digits = (phone ?? '').replace(/\D/g, '');
  const q = `text=${encodeURIComponent(text)}`;
  return digits ? `https://wa.me/${digits}?${q}` : `https://wa.me/?${q}`;
};

/** Revisar mensaje — VERA propone; el usuario SIEMPRE puede corregir antes de
 * enviar. Editable + Copiar + Abrir en WhatsApp. VERA nunca envía sola. */
export const ReviewMessageModal = ({ open, onClose, contactName, initialMessage, phone }: Props): ReactElement | null => {
  const [text, setText] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setText(initialMessage);
      setCopied(false);
    }
  }, [open, initialMessage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {
      /* ignore */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const openWhatsApp = () => {
    const win = window.open(waLink(text, phone), '_blank');
    if (win) win.opener = null;
  };

  return createPortal(
    <div className="vera-overlay" onClick={onClose}>
      <div className="vera-review" data-testid="review-message-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="vera-review__head">
          <div className="vera-review__title">
            <span className="vera-review__icon"><Pencil size={15} /></span>
            <div>
              <h3>Revisar mensaje</h3>
              <p className="vera-muted">Para {contactName} · editá lo que quieras antes de enviar.</p>
            </div>
          </div>
          <button type="button" className="vera-review__close" data-testid="review-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <textarea
          className="vera-review__textarea"
          data-testid="review-textarea"
          value={text}
          rows={6}
          onChange={(e) => setText(e.target.value)}
        />

        <p className="vera-review__hint">VERA propone; vos decidís. Nada se envía automáticamente.</p>

        <div className="vera-review__actions">
          <button type="button" className="vera-btn vera-btn--secondary vera-btn--sm" data-testid="review-copy" onClick={copy}>
            {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
          <button type="button" className="vera-btn vera-btn--primary vera-btn--sm" data-testid="review-whatsapp" onClick={openWhatsApp}>
            <MessageCircle size={14} /> Abrir en WhatsApp
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
