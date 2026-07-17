import { useState } from 'react';
import { Settings2, ArrowUp, ArrowDown, X, RotateCcw } from 'lucide-react';
import { WIDGETS, widgetById } from './widget-registry';
import { useDashboard } from './useDashboard';
import { Dock } from './Dock';

/**
 * Workspace Personal — la pantalla "Hoy" como escritorio del profesional.
 * Ambient Intelligence UI + Dashboard Engine (widgets activables/reordenables) + Dock.
 */
export const WorkspaceHome = () => {
  const { layout, isEnabled, toggle, move, reset } = useDashboard();
  const [editing, setEditing] = useState(false);

  return (
    <div className="vera-home" data-testid="workspace-home">
      <div className="vera-home__ambient" aria-hidden="true">
        <span className="vera-home__glow vera-home__glow--1" />
        <span className="vera-home__glow vera-home__glow--2" />
        <span className="vera-home__glow vera-home__glow--3" />
      </div>

      <div className="vera-home__head">
        <div>
          <h1 className="vera-home__title">Tu espacio de trabajo</h1>
          <p className="vera-home__sub">Todo lo que necesitás para tu día, en un solo lugar.</p>
        </div>
        <button
          type="button"
          className={`vera-btn vera-btn--${editing ? 'primary' : 'ghost'} vera-btn--sm`}
          data-testid="customize-widgets"
          onClick={() => setEditing((e) => !e)}
        >
          <Settings2 size={15} /> {editing ? 'Listo' : 'Personalizar'}
        </button>
      </div>

      {editing && (
        <div className="vera-widget-picker" data-testid="widget-picker">
          <span className="vera-widget-picker__label">Widgets disponibles</span>
          <div className="vera-widget-picker__chips">
            {WIDGETS.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`vera-chip ${isEnabled(w.id) ? 'vera-chip--active' : ''}`.trim()}
                data-testid={`widget-toggle-${w.id}`}
                onClick={() => toggle(w.id)}
              >
                <w.icon size={13} /> {w.title}
              </button>
            ))}
          </div>
          <button type="button" className="vera-ai-action" data-testid="reset-widgets" onClick={reset}>
            <RotateCcw size={13} /> Restablecer
          </button>
        </div>
      )}

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
                <div className="vera-widget__ctl">
                  {w.demo && <span className="vera-widget__demo">Demo</span>}
                  {editing && (
                    <>
                      <button type="button" className="vera-widget__btn" data-testid={`widget-up-${id}`} onClick={() => move(id, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                      <button type="button" className="vera-widget__btn" data-testid={`widget-down-${id}`} onClick={() => move(id, 1)} aria-label="Bajar"><ArrowDown size={14} /></button>
                      <button type="button" className="vera-widget__btn" data-testid={`widget-remove-${id}`} onClick={() => toggle(id)} aria-label="Quitar"><X size={14} /></button>
                    </>
                  )}
                </div>
              </header>
              <div className="vera-widget__body">
                <Component />
              </div>
            </section>
          );
        })}
      </div>

      <Dock />
    </div>
  );
};

export default WorkspaceHome;
