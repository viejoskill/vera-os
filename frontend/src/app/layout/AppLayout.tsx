import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { Sidebar, TopBar, type SidebarItem } from '@vera/ui';
import { appConfig, workspaceConfig } from '@vera/config';
import { navRoutes } from '@app/navigation';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { useAuthUser } from '@app/auth/useAuthUser';
import { useAuth } from '@app/auth/AuthProvider';
import { AudioPlayerProvider } from '@app/workspace/AudioPlayerContext';

export const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName } = useAuthUser();
  const { approval, approvalReady } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Empleados (aprobados, no admin): acceso restringido a Alquileres + Studio (editor de fotos).
  const isEmployee = approvalReady && approval && !approval.isAdmin;
  const EMPLOYEE_PATHS = ['/alquileres', '/studio'];
  useEffect(() => {
    if (isEmployee && !EMPLOYEE_PATHS.some((p) => location.pathname.startsWith(p))) {
      navigate('/alquileres', { replace: true });
    }
  }, [isEmployee, location.pathname, navigate]);

  const active = navRoutes.find((r) => location.pathname.startsWith(r.path)) ?? navRoutes[1];

  const items: SidebarItem[] = navRoutes
    .filter((r) => r.enabled !== false)
    .filter((r) => (approval?.isAdmin ? true : (r.id === 'alquileres' || r.id === 'studio')))
    .map((r) => ({
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
      <AudioPlayerProvider>
      {mobileOpen && (
        <div className="vera-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}
      <Sidebar
        brandName={workspaceConfig.name}
        logoSrc={workspaceConfig.logo}
        tagline={workspaceConfig.tagline}
        items={items}
        activeId={active.id}
        onNavigate={handleNavigate}
        user={{ name: displayName }}
        open={mobileOpen}
      />
      <div className="vera-shell__body">
        {/* Ambient Intelligence — halo global que respira y cambia sutilmente por App */}
        <div className="vera-shell__ambient" data-app={active.id} aria-hidden="true">
          <span className="vera-shell__halo" />
        </div>
        <TopBar
          title={active.label}
          subtitle={appConfig.tagline}
          onMenuClick={() => setMobileOpen((v) => !v)}
          actions={<>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="vera-topbar-web"
              data-testid="topbar-web-link"
              title="Abrir la web pública en una pestaña nueva"
            >
              <Globe size={16} /> Ver web
            </a>
            <NotificationBell />
            <UserMenu />
          </>}
        />
        <main className="vera-shell__content">
          <Outlet />
        </main>
      </div>
      </AudioPlayerProvider>
    </div>
  );
};
