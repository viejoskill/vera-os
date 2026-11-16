import { env } from '@vera/config';
import { supabase } from './supabase-client';

/**
 * Intercepta TODO fetch() hacia el backend de VERA OS y le agrega el Bearer
 * token de la sesión de Supabase — así no hay que tocar los 30+ call-sites que
 * ya hacen `fetch(env.backendUrl + ...)` en todas las pantallas. Si el backend
 * responde 401 (sesión inválida/expirada o cuenta desactivada), dispara un
 * evento global para que la app cierre sesión y vuelva a /login.
 *
 * Se instala UNA sola vez (ver `installFetchInterceptor`), antes de que
 * cualquier pantalla haga su primer fetch.
 */
let installed = false;

export const UNAUTHORIZED_EVENT = 'vera:unauthorized';

export function installFetchInterceptor() {
  if (installed) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const targetsBackend = Boolean(env.backendUrl) && url.startsWith(env.backendUrl);

    if (!targetsBackend) return originalFetch(input, init);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await originalFetch(input, { ...init, headers });
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return response;
  };
}
