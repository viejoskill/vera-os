import { Palette, Moon, Sun, Building2 } from 'lucide-react';
import { workspaceConfig } from '@vera/config';

/** Preferencias básicas — identidad y apariencia del Workspace (WorkspaceConfig).
 * La edición completa llega en un sprint posterior; hoy es el reflejo del sistema. */
export const PreferencesPanel = () => (
  <div className="vera-prefs" data-testid="preferences-panel">
    <section className="vera-prefs__card">
      <header className="vera-prefs__head">
        <span className="vera-prefs__head-icon"><Building2 size={16} /></span>
        <div>
          <h4 className="vera-prefs__title">Identidad del Workspace</h4>
          <p className="vera-muted">Nombre y firma que se muestran en todo VERA.</p>
        </div>
      </header>
      <div className="vera-prefs__rows">
        <div className="vera-prefs__row">
          <span className="vera-prefs__label">Nombre</span>
          <span className="vera-prefs__value" data-testid="pref-name">{workspaceConfig.name}</span>
        </div>
        <div className="vera-prefs__row">
          <span className="vera-prefs__label">Firma</span>
          <span className="vera-prefs__value">{workspaceConfig.tagline}</span>
        </div>
      </div>
    </section>

    <section className="vera-prefs__card">
      <header className="vera-prefs__head">
        <span className="vera-prefs__head-icon"><Palette size={16} /></span>
        <div>
          <h4 className="vera-prefs__title">Apariencia</h4>
          <p className="vera-muted">Tema y color de acento del sistema.</p>
        </div>
      </header>
      <div className="vera-prefs__rows">
        <div className="vera-prefs__row">
          <span className="vera-prefs__label">Tema</span>
          <div className="vera-prefs__themes">
            <span className={`vera-prefs__theme ${workspaceConfig.theme === 'dark' ? 'is-active' : ''}`}>
              <Moon size={14} /> Oscuro
            </span>
            <span className={`vera-prefs__theme ${workspaceConfig.theme === 'light' ? 'is-active' : ''}`}>
              <Sun size={14} /> Claro
            </span>
          </div>
        </div>
        <div className="vera-prefs__row">
          <span className="vera-prefs__label">Acento</span>
          <span className="vera-prefs__accent">
            <span className="vera-prefs__swatch" style={{ background: workspaceConfig.accent }} />
            {workspaceConfig.accent}
          </span>
        </div>
      </div>
      <p className="vera-prefs__note">Edición de identidad y apariencia — próximamente.</p>
    </section>
  </div>
);
