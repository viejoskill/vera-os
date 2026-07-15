import type { ReactNode } from 'react';

export interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Shown only on mobile to toggle the sidebar drawer. */
  onMenuClick?: () => void;
}

/** VERA TopBar — contextual header. Presentational. */
export const TopBar = ({ title, subtitle, actions, onMenuClick }: TopBarProps) => (
  <header className="vera-topbar">
    <button
      type="button"
      className="vera-topbar__menu"
      aria-label="Abrir menú"
      onClick={onMenuClick}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
    <div>
      <h1 className="vera-topbar__title">{title}</h1>
      {subtitle && <p className="vera-topbar__subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="vera-topbar__actions">{actions}</div>}
  </header>
);
