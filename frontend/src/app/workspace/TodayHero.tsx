import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuthUser } from '@app/auth/useAuthUser';
import { useInsights } from '@app/insights';

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

const TYPE_INFO: Record<string, { color: string; sing: string; plur: string }> = {
  priority: { color: '#b06bf0', sing: 'propiedad para atender', plur: 'propiedades para atender' },
  risk: { color: '#f0932b', sing: 'riesgo detectado', plur: 'riesgos detectados' },
  opportunity: { color: '#46e08a', sing: 'oportunidad comercial', plur: 'oportunidades comerciales' },
  recommendation: { color: '#4aa3f0', sing: 'recomendación', plur: 'recomendaciones' },
  reminder: { color: '#3fd0c9', sing: 'recordatorio', plur: 'recordatorios' },
  task: { color: '#f0932b', sing: 'tarea importante', plur: 'tareas importantes' },
};
const ORDER = ['opportunity', 'priority', 'risk', 'recommendation', 'reminder', 'task'];

/** Encabezado AI-First de Hoy. VERA ya revisó todo y resume lo importante.
 * El usuario siente que hay una inteligencia trabajando por él. */
export const TodayHero = ({ onAsk }: { onAsk: () => void }) => {
  const { greetingName } = useAuthUser();
  const { data, isLoading } = useInsights();

  const byType = data?.summary.by_type ?? {};
  const active = data?.summary.active_conversations ?? 0;

  const lines = ORDER.filter((t) => (byType[t] ?? 0) > 0).map((t) => {
    const n = byType[t];
    const info = TYPE_INFO[t];
    return { color: info.color, text: `${n} ${n === 1 ? info.sing : info.plur}` };
  });
  if (active > 0) {
    lines.push({ color: '#cfcfcf', text: `${active} ${active === 1 ? 'conversación activa' : 'conversaciones activas'}` });
  }

  return (
    <section className="vera-hero" data-testid="today-hero">
      <span className="vera-hero__eyebrow"><Sparkles size={13} /> VERA ya revisó todo por vos</span>
      <h1 className="vera-hero__greeting" data-testid="today-greeting">
        {greeting()}, {greetingName}.
      </h1>

      {isLoading ? (
        <p className="vera-hero__loading">Estoy revisando tu día…</p>
      ) : lines.length === 0 ? (
        <p className="vera-hero__intro">Revisé todo y no hay nada urgente ahora. Buen momento para avanzar con lo que quieras.</p>
      ) : (
        <>
          <p className="vera-hero__intro">Hoy encontré:</p>
          <ul className="vera-hero__list" data-testid="today-summary">
            {lines.map((l) => (
              <li key={l.text} className="vera-hero__item">
                <span className="vera-hero__dot" style={{ background: l.color, boxShadow: `0 0 10px ${l.color}66` }} />
                {l.text}
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="vera-hero__cta" data-testid="today-ask" onClick={onAsk}>
        ¿Qué querés hacer? <ArrowRight size={16} />
      </button>
    </section>
  );
};
