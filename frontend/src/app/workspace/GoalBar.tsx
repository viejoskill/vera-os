import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, X, Check } from 'lucide-react';
import { veraBrain, type Goal } from '@app/brain/brain-gateway';

const PRESETS: { type: string; title: string }[] = [
  { type: 'sell_property', title: 'Vender una propiedad' },
  { type: 'capture_owners', title: 'Captar propietarios' },
  { type: 'prioritize_rentals', title: 'Priorizar alquileres' },
  { type: 'increase_appraisals', title: 'Aumentar tasaciones' },
];

/** GoalBar — el OBJETIVO actual del usuario. VERA razona en función de esto (Goals).
 * No es un widget más: enmarca el día y le dice a VERA qué priorizar. */
export const GoalBar = () => {
  const qc = useQueryClient();
  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: veraBrain.goals,
    staleTime: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const add = async (type: string, title: string) => {
    if (!title.trim()) return;
    await veraBrain.setGoal({ type, title: title.trim() });
    setCustom('');
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['goals'] });
  };

  const archive = async (id: string) => {
    await veraBrain.updateGoal(id, 'archived');
    qc.invalidateQueries({ queryKey: ['goals'] });
  };

  return (
    <section className="vera-goal" data-testid="goal-bar">
      <div className="vera-goal__head">
        <span className="vera-goal__label">
          <Target size={14} /> Objetivo activo
        </span>
        <button
          type="button"
          className="vera-goal__toggle"
          data-testid="goal-add"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={14} /> {goals.length ? 'Cambiar objetivo' : 'Definir objetivo'}
        </button>
      </div>

      {goals.length > 0 ? (
        <div className="vera-goal__chips">
          {goals.map((g) => (
            <span key={g.id} className="vera-goal__chip" data-testid="goal-chip">
              {g.title}
              <button
                type="button"
                className="vera-goal__chip-x"
                data-testid="goal-archive"
                onClick={() => archive(g.id)}
                aria-label="Quitar objetivo"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="vera-goal__empty" data-testid="goal-empty">
          Definí un objetivo y VERA priorizará todo en función de eso.
        </p>
      )}

      {open && (
        <div className="vera-goal__picker" data-testid="goal-picker">
          {PRESETS.map((p) => (
            <button
              key={p.type}
              type="button"
              className="vera-goal__preset"
              data-testid={`goal-preset-${p.type}`}
              onClick={() => add(p.type, p.title)}
            >
              {p.title}
            </button>
          ))}
          <form
            className="vera-goal__custom"
            onSubmit={(e) => {
              e.preventDefault();
              add('custom', custom);
            }}
          >
            <input
              className="vera-goal__custom-input"
              data-testid="goal-custom-input"
              placeholder="Otro objetivo…"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            {custom.trim() && (
              <button type="submit" className="vera-goal__custom-btn" data-testid="goal-custom-submit" aria-label="Agregar">
                <Check size={14} />
              </button>
            )}
          </form>
        </div>
      )}
    </section>
  );
};
