import { useAuth } from './AuthProvider';

export interface AuthUserView {
  email: string;
  /** Full name from Supabase Auth metadata, or the email as a temporary fallback. */
  displayName: string;
  /** First name for greetings (falls back to the email local part). */
  greetingName: string;
  initials: string;
}

/** Derives a display-ready user purely from Supabase Auth session data (no profiles table). */
export function useAuthUser(): AuthUserView {
  const { session } = useAuth();
  const user = session?.user;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const email = user?.email ?? '';

  const rawName = String(meta.full_name || meta.name || '').trim();
  const displayName = rawName || email;
  const greetingName = rawName
    ? rawName.split(/\s+/)[0]
    : email.split('@')[0] || 'Hola';

  const initialsSource = rawName || email;
  const initials =
    initialsSource
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U';

  return { email, displayName, greetingName, initials };
}
