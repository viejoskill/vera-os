import { useQuery } from '@tanstack/react-query';
import { Footprints, MessageCircle, Heart, TrendingUp, Sparkles, Target } from 'lucide-react';
import { visitService } from '@vera/services';

/**
 * Estadísticas — SOLO métricas del activo. Hoy las visitas son reales; el resto
 * (consultas, favoritos, conversión, insights) llegan cuando conectemos las fuentes.
 * Separadas de la edición: acá no se carga nada, solo se mide.
 */
export const StatsSection = ({ propertyId }: { propertyId: string }) => {
  const { data: visits = [] } = useQuery({
    queryKey: ['visits', propertyId],
    queryFn: () => visitService.list(propertyId),
    enabled: !!propertyId,
  });

  const metrics = [
    { key: 'visitas', icon: Footprints, label: 'Visitas', value: String(visits.length), soon: false },
    { key: 'consultas', icon: MessageCircle, label: 'Consultas', value: '—', soon: true },
    { key: 'favoritos', icon: Heart, label: 'Favoritos', value: '—', soon: true },
    { key: 'conversion', icon: Target, label: 'Conversión', value: '—', soon: true },
    { key: 'rendimiento', icon: TrendingUp, label: 'Rendimiento', value: '—', soon: true },
    { key: 'insights', icon: Sparkles, label: 'Insights IA', value: '—', soon: true },
  ];

  return (
    <div className="vera-stats" data-testid="stats-section">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.key} className="vera-stat" data-testid={`stat-${m.key}`}>
            <span className="vera-stat__value">{m.value}</span>
            <span className="vera-stat__label"><Icon size={14} /> {m.label}</span>
            {m.soon && <span className="vera-stat__soon">Próximamente</span>}
          </div>
        );
      })}
    </div>
  );
};
