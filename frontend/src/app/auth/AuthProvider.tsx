import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { env } from '@vera/config';
import { supabase, hasStoredSession } from './supabase-client';

export interface Approval {
  email: string;
  approved: boolean;
  isAdmin: boolean;
}

interface AuthContextValue {
  session: Session | null;
  /** True once getSession() has resolved (initial hydration finished). */
  ready: boolean;
  /** Optimistic guess from localStorage, used only before `ready` to avoid flashes. */
  bootAuthed: boolean;
  /** Team access status for the current user. null while unknown. */
  approval: Approval | null;
  /** True once the approval check for the current session has resolved. */
  approvalReady: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  ready: false,
  bootAuthed: false,
  approval: null,
  approvalReady: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bootAuthed] = useState(hasStoredSession);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalReady, setApprovalReady] = useState(false);

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

  // Whenever the signed-in user changes, check team access.
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) {
      setApproval(null);
      setApprovalReady(true);
      return;
    }
    let active = true;
    setApprovalReady(false);
    fetch(`${env.backendUrl}/api/auth/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Approval | null) => {
        if (!active) return;
        setApproval(data);
        setApprovalReady(true);
      })
      .catch(() => {
        if (!active) return;
        setApproval(null);
        setApprovalReady(true);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.email]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, ready, bootAuthed, approval, approvalReady, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
