import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Copy, Check, Clock } from 'lucide-react';
import type { Opportunity } from './types';

const inactivityLabel = (hours: number): string => {
  const days = Math.floor(hours / 24);
  if (days >= 1) return `Hace ${days} ${days === 1 ? 'día' : 'días'} sin respuesta`;
  return `Hace ${hours} h sin respuesta`;
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Prioridad alta',
  medium: 'Prioridad media',
  low: 'Prioridad baja',
};

/** Tarjeta de oportunidad. VERA propone (seguimiento + mensaje sugerido);
 * el usuario decide. Copia el mensaje o abre la conversación — nunca se envía solo. */
export const OpportunityCard = ({ opportunity }: { opportunity: Opportunity }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = opportunity.suggested_message;
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
      /* ignore — igual damos feedback */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <article className={`vera-opp-card prio--${opportunity.priority}`} data-testid={`opportunity-${opportunity.contact_id}`}>
      <div className="vera-opp-card__top">
        <span className="vera-opp-card__dot" aria-hidden="true" />
        <div className="vera-opp-card__id">
          <span className="vera-opp-card__name">{opportunity.contact_name}</span>
          <span className="vera-opp-card__tag">Seguimiento sugerido</span>
        </div>
        <span className="vera-opp-card__prio">{PRIORITY_LABEL[opportunity.priority] ?? opportunity.priority}</span>
      </div>

      <span className="vera-opp-card__inactive">
        <Clock size={12} /> {inactivityLabel(opportunity.hours_since_last)}
      </span>
      <p className="vera-opp-card__reason">{opportunity.reason}</p>

      {opportunity.signals.length > 0 && (
        <div className="vera-opp-card__signals">
          {opportunity.signals.map((s) => (
            <span key={s} className="vera-opp-card__signal">{s}</span>
          ))}
        </div>
      )}

      <div className="vera-opp-card__message" data-testid={`opportunity-message-${opportunity.contact_id}`}>
        {opportunity.suggested_message}
      </div>

      <div className="vera-opp-card__actions">
        <button
          type="button"
          className="vera-btn vera-btn--secondary vera-btn--sm"
          data-testid={`opportunity-open-${opportunity.contact_id}`}
          onClick={() => navigate('/vera-bot')}
        >
          <MessageSquare size={14} /> Ver conversación
        </button>
        <button
          type="button"
          className="vera-btn vera-btn--primary vera-btn--sm"
          data-testid={`opportunity-copy-${opportunity.contact_id}`}
          onClick={copy}
        >
          {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar mensaje sugerido</>}
        </button>
      </div>
    </article>
  );
};
