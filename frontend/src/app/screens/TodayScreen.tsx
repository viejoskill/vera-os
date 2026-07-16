import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { InboxRecommendation, RecommendationPriority, WorkspaceRoute } from '@vera/types';
import { useToday } from '@app/hooks/useToday';
import { useAuthUser } from '@app/auth/useAuthUser';

const TIER_LABEL: Record<RecommendationPriority, string> = {
  alta: 'Alta prioridad',
  atencion: 'Atención',
  lista: 'Listas · Oportunidades',
};

const TIER_ORDER: RecommendationPriority[] = ['alta', 'atencion', 'lista'];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function routeToUrl(t: WorkspaceRoute): string {
  const params = new URLSearchParams({ section: t.section });
  if (t.focus) params.set('focus', t.focus);
  return `/propiedades/${t.entityId}?${params.toString()}`;
}

const RecommendationCard = ({
  rec,
  onResolve,
}: {
  rec: InboxRecommendation;
  onResolve: (t: WorkspaceRoute) => void;
}) => (
  <article className={`vera-rec vera-rec--${rec.priority}`} data-testid={`recommendation-${rec.id}`}>
    <span className="vera-rec__subject">{rec.subject}</span>
    <h3 className="vera-rec__title">{rec.title}</h3>
    <p className="vera-rec__line">{rec.whatHappened}</p>
    <p className="vera-rec__line vera-rec__line--muted">{rec.whyItMatters}</p>
    <p className="vera-rec__reco">
      <span className="vera-rec__reco-label">VERA recomienda</span>{' '}
      {rec.recommendation}
    </p>
    <button
      type="button"
      className="vera-rec__cta"
      data-testid={`resolve-now-${rec.id}`}
      onClick={() => onResolve(rec.target)}
    >
      Resolver ahora <ArrowRight size={15} />
    </button>
  </article>
);

export const TodayScreen = () => {
  const navigate = useNavigate();
  const { greetingName } = useAuthUser();
  const { data, isLoading } = useToday();

  const recommendations = data?.recommendations ?? [];
  const mood = isLoading ? 'active' : (data?.mood ?? 'serene');
  const attention = recommendations.filter((r) => r.priority !== 'lista').length;

  const summary = isLoading
    ? 'VERA está analizando tu operación…'
    : attention > 0
      ? `Hay ${attention} ${attention === 1 ? 'tema' : 'temas'} que ${attention === 1 ? 'requiere' : 'requieren'} tu atención.`
      : 'Todo bajo control. VERA sigue atenta por vos.';

  const onResolve = (t: WorkspaceRoute) => navigate(routeToUrl(t));

  const byTier = (p: RecommendationPriority) => recommendations.filter((r) => r.priority === p);

  return (
    <div className="vera-today" data-testid="today-screen">
      <div className="vera-today__mood" data-mood={mood} aria-hidden="true">
        <span className="vera-today__glow vera-today__glow--1" />
        <span className="vera-today__glow vera-today__glow--2" />
        <span className="vera-today__glow vera-today__glow--3" />
      </div>

      <div className="vera-today__inner">
        <header className="vera-today__header">
          <h1 className="vera-today__greeting">
            {greeting()}, <span>{greetingName}.</span>
          </h1>
          <p className="vera-today__summary" data-testid="today-summary">
            {summary}
          </p>
        </header>

        {isLoading ? (
          <p className="vera-muted vera-today__state">Preparando tus prioridades…</p>
        ) : recommendations.length === 0 ? (
          <div className="vera-today__empty" data-testid="today-empty">
            <p className="vera-today__empty-title">Todo al día.</p>
            <p className="vera-muted">No hay acciones prioritarias por ahora.</p>
          </div>
        ) : (
          <div className="vera-today__sections">
            {TIER_ORDER.map((tier) => {
              const items = byTier(tier);
              if (!items.length) return null;
              return (
                <section key={tier} className="vera-today__section" data-testid={`tier-${tier}`}>
                  <h2 className={`vera-today__section-title vera-today__section-title--${tier}`}>
                    <span className="vera-today__dot" />
                    {TIER_LABEL[tier]}
                  </h2>
                  <div className="vera-today__cards">
                    {items.map((rec) => (
                      <RecommendationCard key={rec.id} rec={rec} onResolve={onResolve} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
