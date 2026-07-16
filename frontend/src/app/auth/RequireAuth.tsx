import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * Route guard. No session → Login (preserving the intended location so we can
 * return there after signing in). Returning users with a stored session render
 * the app instantly; we only redirect once hydration confirms there is no session.
 */
export const RequireAuth = () => {
  const { session, ready, bootAuthed } = useAuth();
  const location = useLocation();

  if (!ready) {
    // Optimistic: a stored token → render the app right away (no flash).
    // No stored token → render nothing for the microtask until hydration resolves.
    return bootAuthed ? <Outlet /> : null;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
