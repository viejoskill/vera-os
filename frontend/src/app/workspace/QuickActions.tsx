import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, SlidersHorizontal, Check, RotateCcw, X } from 'lucide-react';
import { BrandIcon } from '@vera/ui';
import { INTEGRATIONS } from '@app/integraciones';
import { useIntegrations } from '@app/integraciones';
import { QUICK_ACTIONS, quickActionById, type QuickAction } from './quick-actions-catalog';
import { useQuickActions } from './useQuickActions';

const integrationOf = (key?: string) => INTEGRATIONS.find((i) => i.key === key);

/** Acciones Rápidas — el centro de operaciones de "Hoy". Acciones (no accesos):
 * navegar, abrir una integración (URL desde Integraciones) o el Sitio Web
 * principal. La configuración vive SOLO en Integraciones; acá se consume. */
export const QuickActions = () => {
  const navigate = useNavigate();
  const { pinned, isPinned, toggle, reset } = useQuickActions();
  const { primarySiteUrl } = useIntegrations();
  const [editing, setEditing] = useState(false);

  const run = (a: QuickAction) => {
    if (a.kind === 'route' && a.route) {
      navigate(a.route);
      return;
    }
    if (a.kind === 'integration') {
      const url = integrationOf(a.integrationKey)?.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // 'site' — consume el dominio principal de Integraciones; si no hay, guía.
    const site = primarySiteUrl();
    if (site) window.open(site, '_blank', 'noopener,noreferrer');
    else navigate('/integraciones');
  };

  const renderIcon = (a: QuickAction, size: number) => {
    if (a.kind === 'integration') {
      const i = integrationOf(a.integrationKey);
      return <BrandIcon brand={i?.brand} fallback={a.icon} size={size} mono={!i?.brandFullColor} />;
    }
    return <a.icon size={size} />;
  };

  const pinnedActions = pinned
    .map((id) => quickActionById(id))
    .filter((a): a is QuickAction => Boolean(a));

  return (
    <section className="vera-qa" data-testid="quick-actions">
      <header className="vera-qa__head">
        <span className="vera-qa__title"><Zap size={15} /> Acciones Rápidas</span>
        <button
          type="button"
          className="vera-qa__edit"
          data-testid="quick-actions-customize"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? <X size={14} /> : <SlidersHorizontal size={14} />} {editing ? 'Listo' : 'Personalizar'}
        </button>
      </header>

      {editing && (
        <div className="vera-qa__picker" data-testid="quick-actions-picker">
          <span className="vera-qa__picker-label">Fijá tus acciones</span>
          <div className="vera-qa__picker-chips">
            {QUICK_ACTIONS.map((a) => {
              const on = isPinned(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`vera-qa__chip ${on ? 'is-on' : ''}`.trim()}
                  data-testid={`quick-action-toggle-${a.id}`}
                  onClick={() => toggle(a.id)}
                >
                  {renderIcon(a, 14)} {a.label}
                  {on && <Check size={13} className="vera-qa__chip-check" />}
                </button>
              );
            })}
          </div>
          <button type="button" className="vera-ai-action" data-testid="quick-actions-reset" onClick={reset}>
            <RotateCcw size={13} /> Restablecer
          </button>
        </div>
      )}

      {pinnedActions.length === 0 ? (
        <p className="vera-qa__empty" data-testid="quick-actions-empty">
          No hay acciones fijadas. Tocá "Personalizar" para agregar.
        </p>
      ) : (
        <div className="vera-qa__grid">
          {pinnedActions.map((a) => (
            <button
              key={a.id}
              type="button"
              className="vera-qa__btn"
              data-testid={`quick-action-${a.id}`}
              onClick={() => run(a)}
            >
              <span className="vera-qa__icon">{renderIcon(a, 22)}</span>
              <span className="vera-qa__label">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
