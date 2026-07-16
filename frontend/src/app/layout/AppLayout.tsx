import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar, TopBar, type SidebarItem } from '@vera/ui';
import { appConfig } from '@vera/config';
import { Role, ROLE_LABELS } from '@vera/types';
import { navRoutes } from '@app/navigation';
import { UserMenu } from './UserMenu';

const mockUser = { name: 'Valentina Ríos', role: ROLE_LABELS[Role.BROKER] };

export const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const active = navRoutes.find((r) => location.pathname.startsWith(r.path)) ?? navRoutes[1];

  const items: SidebarItem[] = navRoutes.map((r) => ({
    id: r.id,
    label: r.label,
    icon: r.icon,
    enabled: r.enabled,
  }));

  const handleNavigate = (id: string) => {
    const route = navRoutes.find((r) => r.id === id);
    if (route) navigate(route.path);
    setMobileOpen(false);
  };

  return (
    <div className="vera-shell">
      {mobileOpen && (
        <div className="vera-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <Sidebar
        brandName={appConfig.name}
        items={items}
        activeId={active.id}
        onNavigate={handleNavigate}
        user={mockUser}
        open={mobileOpen}
      />
      <div className="vera-shell__body">
        <TopBar
          title={active.label}
          subtitle={appConfig.tagline}
          onMenuClick={() => setMobileOpen((v) => !v)}
          actions={<UserMenu name={mockUser.name} role={mockUser.role} />}
        />
        <main className="vera-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
