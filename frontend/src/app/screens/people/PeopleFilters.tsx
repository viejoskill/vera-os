import { Select, Button } from '@vera/ui';
import { X } from 'lucide-react';
import type { PeopleFacets } from '@vera/types';

const CONFIDENCE_OPTIONS = [
  { value: '', label: 'Confianza: cualquiera' },
  { value: '0.85', label: 'Confianza: Alta' },
  { value: '0.6', label: 'Confianza: Media o más' },
];

const CONTACTED_OPTIONS = [
  { value: '', label: 'Última interacción: cualquiera' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

export interface PeopleFiltersProps {
  facets?: PeopleFacets;
  factValues: Record<string, string>;
  onFactChange: (type: string, value: string) => void;
  budgetMin: string;
  budgetMax: string;
  onBudget: (which: 'min' | 'max', v: string) => void;
  confidenceMin: string;
  onConfidence: (v: string) => void;
  contactedWithin: string;
  onContacted: (v: string) => void;
  onClear: () => void;
  activeCount: number;
}

/** Filtros de negocio (no de base de datos). Combinables con AND.
 * Base reutilizable para el futuro módulo Audiencias. */
export const PeopleFilters = ({
  facets,
  factValues,
  onFactChange,
  budgetMin,
  budgetMax,
  onBudget,
  confidenceMin,
  onConfidence,
  contactedWithin,
  onContacted,
  onClear,
  activeCount,
}: PeopleFiltersProps) => {
  const filters = facets?.filters ?? {};
  const values = facets?.values ?? {};

  return (
    <div className="vera-pfilters" data-testid="people-filters">
      {Object.entries(filters).map(([type, label]) => {
        const opts = values[type] ?? [];
        return (
          <Select
            key={type}
            aria-label={label}
            value={factValues[type] ?? ''}
            onChange={(e) => onFactChange(type, e.target.value)}
            data-testid={`filter-${type}`}
            options={[
              { value: '', label: `${label}: todos` },
              ...opts.map((v) => ({ value: v, label: v })),
            ]}
          />
        );
      })}

      <div className="vera-pfilters__budget">
        <input
          type="number"
          className="vera-input vera-pfilters__num"
          placeholder="USD mín."
          value={budgetMin}
          onChange={(e) => onBudget('min', e.target.value)}
          aria-label="Presupuesto mínimo (USD)"
          data-testid="filter-budget-min"
        />
        <span className="vera-pfilters__dash">–</span>
        <input
          type="number"
          className="vera-input vera-pfilters__num"
          placeholder="USD máx."
          value={budgetMax}
          onChange={(e) => onBudget('max', e.target.value)}
          aria-label="Presupuesto máximo (USD)"
          data-testid="filter-budget-max"
        />
      </div>

      <Select
        aria-label="Última interacción"
        value={contactedWithin}
        onChange={(e) => onContacted(e.target.value)}
        options={CONTACTED_OPTIONS}
        data-testid="filter-contacted"
      />

      <Select
        aria-label="Nivel de confianza"
        value={confidenceMin}
        onChange={(e) => onConfidence(e.target.value)}
        options={CONFIDENCE_OPTIONS}
        data-testid="filter-confidence"
      />

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="filter-clear">
          <X size={14} /> Limpiar ({activeCount})
        </Button>
      )}
    </div>
  );
};
