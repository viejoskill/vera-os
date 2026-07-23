import { createClient } from '@supabase/supabase-js';
import { env } from '@vera/config';

/** Single Supabase client for browser auth. Uses the publishable key (never the service role). */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/**
 * Synchronous best-effort check for a persisted Supabase session in localStorage.
 * Lets returning users render the app instantly (no login flash, no spinner) while
 * `getSession()` confirms in the background.
 */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }
  } catch {
    /* localStorage unavailable */
  }
  return false;
}
