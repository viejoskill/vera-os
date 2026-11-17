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
  const { profile, profileReady, can, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Secciones del menú que el usuario puede VER (admin: todas). Un admin puede
  // personalizar esto por rol desde "Usuarios y Roles".
  const visiblePaths = navRoutes.filter((r) => can(r.id, 'ver')).map((r) => r.path);
  const noSectionsAssigned = Boolean(profileReady && profile && !profile.isAdmin && visiblePaths.length === 0);
  useEffect(() => {
    if (profile && !profile.isAdmin && visiblePaths.length > 0 && !visiblePaths.some((p) => location.pathname.startsWith(p))) {
      navigate(visiblePaths[0], { replace: true });
    }
  }, [profile, location.pathname, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = navRoutes.find((r) => location.pathname.startsWith(r.path)) ?? navRoutes[1];
  // Mientras el redirect de la línea de arriba no se disparó todavía, no
  // montamos la pantalla restringida (evita que dispare sus propios fetches
  // y tire 403s en consola antes de que React Router navegue).
  const canViewActive = Boolean(profile?.isAdmin) || visiblePaths.some((p) => location.pathname.startsWith(p));

  const items: SidebarItem[] = navRoutes
    .filter((r) => r.enabled !== false)
    .filter((r) => can(r.id, 'ver'))
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

  if (noSectionsAssigned) {
    return (
      <div className="vera-shell vera-shell--empty" data-testid="no-sections-screen">
        <div className="vera-no-sections">
          <h2 className="vera-no-sections__title">Sin secciones asignadas</h2>
          <p className="vera-no-sections__text">
            Tu cuenta todavía no tiene ninguna sección habilitada. Pedile a un administrador
            que te asigne acceso desde Usuarios y Roles.
          </p>
          <button type="button" className="vera-no-sections__signout" data-testid="no-sections-signout" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

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
          {canViewActive ? <Outlet /> : null}
        </main>
      </div>
      </AudioPlayerProvider>
    </div>
  );
};
