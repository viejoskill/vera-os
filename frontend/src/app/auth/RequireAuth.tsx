import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { PendingApproval } from './PendingApproval';

/**
 * Route guard. No session → Login (preserving the intended location so we can
 * return there after signing in). Returning users with a stored session render
 * the app instantly; we only redirect once hydration confirms there is no session.
 * Sin perfil activo en `app_access` (pendiente o desactivado) → pantalla de aviso.
 * Clave temporal pendiente de cambio → pantalla de cambio obligatorio.
 */
export const RequireAuth = () => {
  const { session, ready, bootAuthed, profile, profileReady } = useAuth();
  const location = useLocation();

  if (!ready) {
    // Optimistic: a stored token → render the app right away (no flash).
    // No stored token → render nothing for the microtask until hydration resolves.
    return bootAuthed ? <Outlet /> : null;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Gate de acceso: bloquea hasta saber si el usuario tiene perfil activo.
  if (!profileReady) return null;
  if (!profile || !profile.active) return <PendingApproval />;

  if (profile.mustChangePassword && location.pathname !== '/cambiar-clave') {
    return <Navigate to="/cambiar-clave" replace />;
  }

  return <Outlet />;
};
