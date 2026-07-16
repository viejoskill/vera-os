/** Typed access to environment variables. The only place that reads `process.env`.
 *  Uses STATIC references so CRA's DefinePlugin inlines the values at build time. */

export const env = {
  backendUrl: process.env.REACT_APP_BACKEND_URL ?? '',
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
