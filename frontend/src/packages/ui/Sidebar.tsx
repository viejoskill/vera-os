import type { ReactNode } from 'react';
import brandIcon from '../../assets/brand/app-icon.png';

export interface SidebarItem {
  id: string;
  label: string;
  icon: ReactNode;
  enabled?: boolean;
}

export interface SidebarUser {
  name: string;
  role?: string;
}

export interface SidebarProps {
  brandName: string;
  items: SidebarItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  user?: SidebarUser;
  /** Mobile drawer open state. */
  open?: boolean;
  sectionLabel?: string;
}

/** VERA Sidebar — presentational navigation. Routing is the App's concern. */
export const Sidebar = ({
  brandName,
  items,
  activeId,
  onNavigate,
  user,
  open = false,
  sectionLabel = 'Apps',
}: SidebarProps) => {
  const initials = user
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <aside className={`vera-sidebar ${open ? 'vera-sidebar--open' : ''}`.trim()}>
      <div className="vera-sidebar__brand">
        <img className="vera-sidebar__brand-mark" src={brandIcon} alt="" aria-hidden="true" />
        <span className="vera-sidebar__brand-name">
          {brandName} <span className="vera-sidebar__brand-os">OS</span>
        </span>
      </div>

      <nav className="vera-sidebar__nav" aria-label="Navegación principal">
        <span className="vera-sidebar__section">{sectionLabel}</span>
        {items.map((item) => {
          const disabled = item.enabled === false;
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`nav-${item.id}`}
              disabled={disabled}
              aria-current={isActive ? 'page' : undefined}
              className={`vera-sidebar__item ${isActive ? 'vera-sidebar__item--active' : ''}`.trim()}
              onClick={() => !disabled && onNavigate(item.id)}
            >
              <span className="vera-sidebar__icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {disabled && <span className="vera-sidebar__soon">Próximamente</span>}
            </button>
          );
        })}
      </nav>

      {user && (
        <div className="vera-sidebar__footer">
          <div className="vera-sidebar__user">
            <span className="vera-sidebar__avatar">{initials}</span>
            <div>
              <div className="vera-sidebar__user-name">{user.name}</div>
              {user.role && <div className="vera-sidebar__user-role">{user.role}</div>}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
