import { Sparkles } from 'lucide-react';
import { useOpportunities } from './useOpportunities';
import { OpportunityCard } from './OpportunityCard';

/** Sección "Oportunidades sugeridas" en Hoy. VERA detecta y propone; Sebastián
 * decide. No es un CRM ni automatización invasiva: es un asistente que piensa. */
export const OpportunitiesSection = () => {
  const { data: opportunities, isLoading, isError } = useOpportunities();

  return (
    <section className="vera-opps" data-testid="opportunities-section">
      <header className="vera-opps__head">
        <span className="vera-opps__title"><Sparkles size={15} /> Oportunidades sugeridas</span>
        <span className="vera-opps__note">VERA propone · vos decidís</span>
      </header>

      {isLoading ? (
        <p className="vera-opps__empty" data-testid="opportunities-loading">VERA está revisando tus conversaciones…</p>
      ) : isError ? (
        <p className="vera-opps__empty" data-testid="opportunities-error">No pude revisar las oportunidades ahora.</p>
      ) : !opportunities || opportunities.length === 0 ? (
        <p className="vera-opps__empty" data-testid="opportunities-empty">
          Todo al día. No hay seguimientos sugeridos por ahora.
        </p>
      ) : (
        <div className="vera-opps__grid" data-testid="opportunities-grid">
          {opportunities.map((o) => (
            <OpportunityCard key={o.conversation_id} opportunity={o} />
          ))}
        </div>
      )}
    </section>
  );
};
