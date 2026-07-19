import { useState } from 'react';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { widgetById } from './widget-registry';
import { useDashboard } from './useDashboard';
import { Dock } from './Dock';
import { QuickActions } from './QuickActions';
import { TodayHero } from './TodayHero';
import { GoalBar } from './GoalBar';
import { InsightsSection } from '@app/insights';
import { SpotlightModal } from './SpotlightModal';
import { CustomizePanel } from './CustomizePanel';

/**
 * Workspace Personal — la pantalla "Hoy" como escritorio del profesional.
 * Ambient Intelligence UI + Dashboard Engine (widgets activables) + Dock personal
 * + capa de IA reservada (Spotlight). Calma y aire por sobre densidad.
 */
export const WorkspaceHome = () => {
  const { layout, isEnabled, toggle, reset } = useDashboard();
  const [customizing, setCustomizing] = useState(false);
  const [spotlight, setSpotlight] = useState(false);

  return (
    <div className="vera-home" data-testid="workspace-home">
      {/* Protagonista — la voz de VERA (ya trabajó por vos) */}
      <TodayHero onAsk={() => setSpotlight(true)} />

      {/* El objetivo actual — VERA razona en función de esto */}
      <GoalBar />

      {/* Continuar la conversación con VERA */}
      <button
        type="button"
        className="vera-home__spotlight"
        data-testid="spotlight-trigger"
        onClick={() => setSpotlight(true)}
      >
        <Sparkles size={17} className="vera-home__spotlight-icon" />
        <span className="vera-home__spotlight-text">Seguí la conversación con VERA…</span>
        <span className="vera-home__spotlight-badge"><Sparkles size={12} /> VERA</span>
      </button>

      <InsightsSection />

      <QuickActions />

      <div className="vera-home__widgets-head">
        <span className="vera-home__widgets-title">Tu escritorio</span>
        <button
          type="button"
          className="vera-btn vera-btn--secondary vera-btn--sm"
          data-testid="customize-widgets"
          onClick={() => setCustomizing(true)}
        >
          <SlidersHorizontal size={15} /> Personalizar
        </button>
      </div>

      <div className="vera-widget-grid" data-testid="widget-grid">
        {layout.map((id, i) => {
          const w = widgetById(id);
          if (!w) return null;
          const { Component } = w;
          return (
            <section
              key={id}
              className={`vera-widget vera-widget--${w.size}`}
              style={{ animationDelay: `${i * 0.05}s` }}
              data-testid={`widget-${id}`}
            >
              <header className="vera-widget__head">
                <span className="vera-widget__title"><w.icon size={15} /> {w.title}</span>
                {w.demo && <span className="vera-widget__demo">Demo</span>}
              </header>
              <div className="vera-widget__body">
                <Component />
              </div>
            </section>
          );
        })}
      </div>

      <Dock />

      <CustomizePanel
        open={customizing}
        onClose={() => setCustomizing(false)}
        isEnabled={isEnabled}
        toggle={toggle}
        reset={reset}
      />
      <SpotlightModal open={spotlight} onClose={() => setSpotlight(false)} />
    </div>
  );
};

export default WorkspaceHome;
