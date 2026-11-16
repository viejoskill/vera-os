import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { env } from '@vera/config';
import { supabase, hasStoredSession } from './supabase-client';
import { UNAUTHORIZED_EVENT } from './fetch-interceptor';

export interface Profile {
  email: string;
  name: string;
  active: boolean;
  mustChangePassword: boolean;
  isAdmin: boolean;
  roles: { id: string; name: string }[];
  /** módulo (id de navigation.ts) -> acciones permitidas ("ver","crear","editar","borrar","exportar") */
  permissions: Record<string, string[]>;
}

interface AuthContextValue {
  session: Session | null;
  /** True once getSession() has resolved (initial hydration finished). */
  ready: boolean;
  /** Optimistic guess from localStorage, used only before `ready` to avoid flashes. */
  bootAuthed: boolean;
  /** Perfil + permisos efectivos del usuario actual. null mientras se desconoce. */
  profile: Profile | null;
  /** True once /auth/me resolved for the current session. */
  profileReady: boolean;
  /** Atajo: ¿el usuario puede `action` en `module`? Admin siempre true. */
  can: (moduleId: string, action: string) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  ready: false,
  bootAuthed: false,
  profile: null,
  profileReady: false,
  can: () => false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bootAuthed] = useState(hasStoredSession);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${env.backendUrl}/api/auth/me`);
      setProfile(res.ok ? await res.json() : null);
    } catch {
      setProfile(null);
    } finally {
      setProfileReady(true);
    }
  };

  // Cada vez que cambia la sesión, pedimos el perfil + permisos efectivos.
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) {
      setProfile(null);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  // 401 del backend (sesión inválida o cuenta desactivada) -> cerrar sesión ya.
  useEffect(() => {
    const onUnauthorized = () => {
      supabase.auth.signOut();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const can = (moduleId: string, action: string) => {
    if (!profile) return false;
    if (profile.isAdmin) return true;
    return (profile.permissions[moduleId] ?? []).includes(action);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, ready, bootAuthed, profile, profileReady, can, refreshProfile: loadProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
