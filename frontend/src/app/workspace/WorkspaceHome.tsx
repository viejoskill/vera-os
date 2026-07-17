import { useState } from 'react';
import { SlidersHorizontal, Sparkles, Search } from 'lucide-react';
import { widgetById } from './widget-registry';
import { useDashboard } from './useDashboard';
import { Dock } from './Dock';
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
      {/* Capa de IA reservada — Spotlight */}
      <button
        type="button"
        className="vera-home__spotlight"
        data-testid="spotlight-trigger"
        onClick={() => setSpotlight(true)}
      >
        <Search size={17} className="vera-home__spotlight-icon" />
        <span className="vera-home__spotlight-text">¿Qué querés hacer hoy? Preguntale a VERA…</span>
        <span className="vera-home__spotlight-badge"><Sparkles size={12} /> VERA</span>
      </button>

      <div className="vera-home__head">
        <div>
          <h1 className="vera-home__title">Tu espacio de trabajo</h1>
          <p className="vera-home__sub">Todo lo que necesitás para tu día, en un solo lugar.</p>
        </div>
        <button
          type="button"
          className="vera-btn vera-btn--secondary vera-btn--sm"
          data-testid="customize-widgets"
          onClick={() => setCustomizing(true)}
        >
          <SlidersHorizontal size={15} /> Personalizar escritorio
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
