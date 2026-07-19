import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, ArrowUpRight } from 'lucide-react';
import type { Insight } from './types';

const TYPE_META: Record<string, { label: string; cls: string }> = {
  opportunity: { label: 'Oportunidad', cls: 'type--opportunity' },
  risk: { label: 'Riesgo', cls: 'type--risk' },
  recommendation: { label: 'Recomendación', cls: 'type--recommendation' },
  priority: { label: 'Prioridad', cls: 'type--priority' },
  reminder: { label: 'Recordatorio', cls: 'type--reminder' },
  task: { label: 'Tarea', cls: 'type--task' },
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

/** Tarjeta de insight (cualquier tipo). VERA propone; el usuario decide.
 * Copia la acción sugerida o abre el detalle — nunca ejecuta nada solo. */
export const InsightCard = ({ insight }: { insight: Insight }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const meta = TYPE_META[insight.type] ?? { label: insight.type, cls: 'type--opportunity' };

  const copy = async () => {
    const text = insight.suggested_action;
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

  return (
    <article className={`vera-ins-card ${meta.cls}`} data-testid={`insight-${insight.id}`}>
      <div className="vera-ins-card__top">
        <span className="vera-ins-card__dot" aria-hidden="true" />
        <div className="vera-ins-card__id">
          <span className="vera-ins-card__title">{insight.title}</span>
          <span className="vera-ins-card__type">{meta.label}</span>
        </div>
        <span className="vera-ins-card__prio" data-testid={`insight-priority-${insight.id}`}>
          {PRIORITY_LABEL[insight.priority] ?? insight.priority}
        </span>
      </div>

      <p className="vera-ins-card__reason">{insight.reason}</p>

      {insight.signals.length > 0 && (
        <div className="vera-ins-card__signals">
          {insight.signals.map((s) => (
            <span key={s} className="vera-ins-card__signal">{s}</span>
          ))}
        </div>
      )}

      {insight.suggested_action && (
        <div className="vera-ins-card__action" data-testid={`insight-action-${insight.id}`}>
          {insight.suggested_action}
        </div>
      )}

      <div className="vera-ins-card__actions">
        {insight.link_route && (
          <button
            type="button"
            className="vera-btn vera-btn--secondary vera-btn--sm"
            data-testid={`insight-open-${insight.id}`}
            onClick={() => navigate(insight.link_route)}
          >
            {insight.link_label || 'Abrir'} <ArrowUpRight size={14} />
          </button>
        )}
        {insight.suggested_action && insight.action_label && (
          <button
            type="button"
            className="vera-btn vera-btn--primary vera-btn--sm"
            data-testid={`insight-copy-${insight.id}`}
            onClick={copy}
          >
            {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> {insight.action_label}</>}
          </button>
        )}
      </div>
    </article>
  );
};
