import { useState } from 'react';
import { Copy, Check, ShieldAlert } from 'lucide-react';

/** Banner para mostrar una contraseña temporal UNA sola vez (no se vuelve a pedir
 * al backend — si se pierde, hay que resetearla de nuevo). */
export const SecretReveal = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className="vera-secret-reveal" data-testid="secret-reveal">
      <div className="vera-secret-reveal__warn">
        <ShieldAlert size={15} /> {label} — se muestra una sola vez, copiala ahora.
      </div>
      <div className="vera-secret-reveal__row">
        <code className="vera-secret-reveal__value" data-testid="secret-reveal-value">{value}</code>
        <button type="button" className="vera-secret-reveal__copy" data-testid="secret-reveal-copy" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
};
