import { Sparkles } from 'lucide-react';
import { useInsights } from './useInsights';
import { InsightCard } from './InsightCard';

/** VERA Insights — tablero de inteligencia de Hoy. Muestra distintos tipos de
 * insight (oportunidades, riesgos, recomendaciones, prioridades…). VERA detecta
 * y propone; el usuario decide. No es un CRM ni automatización invasiva. */
export const InsightsSection = () => {
  const { data, isLoading, isError } = useInsights();
  const insights = data?.insights;

  return (
    <section className="vera-ins" data-testid="insights-section">
      <header className="vera-ins__head">
        <span className="vera-ins__title"><Sparkles size={15} /> VERA Insights</span>
        <span className="vera-ins__note">VERA propone · vos decidís</span>
      </header>

      {isLoading ? (
        <p className="vera-ins__empty" data-testid="insights-loading">VERA está analizando tu día…</p>
      ) : isError ? (
        <p className="vera-ins__empty" data-testid="insights-error">No pude generar los insights ahora.</p>
      ) : !insights || insights.length === 0 ? (
        <p className="vera-ins__empty" data-testid="insights-empty">
          Todo al día. VERA no encontró nada que requiera tu atención por ahora.
        </p>
      ) : (
        <div className="vera-ins__grid" data-testid="insights-grid">
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </section>
  );
};
