import { useCallback, useEffect, useState } from 'react';
import { useAuthUser } from '@app/auth/useAuthUser';
import { APPS } from './apps-catalog';

const KEY = (email: string) => `vera:dock:${email || 'anon'}`;
const DEFAULT = ['arturito', 'gmail', 'ia', 'mercadolibre', 'whatsapp', 'spotify'];

/** Dock personalizable: apps fijadas por el usuario, persistido en localStorage.
 * Pertenece al usuario, no al sistema. */
export const useDock = () => {
  const { email } = useAuthUser();
  const [pinned, setPinned] = useState<string[]>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(email));
      if (raw) {
        const ids = (JSON.parse(raw) as string[]).filter((id) => APPS.some((a) => a.id === id));
        setPinned(ids);
        return;
      }
    } catch {
      /* ignore */
    }
    setPinned(DEFAULT);
  }, [email]);

  const persist = useCallback(
    (next: string[]) => {
      setPinned(next);
      try {
        localStorage.setItem(KEY(email), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [email],
  );

  const isPinned = (id: string) => pinned.includes(id);
  const toggle = (id: string) =>
    persist(isPinned(id) ? pinned.filter((x) => x !== id) : [...pinned, id]);

  return { pinned, isPinned, toggle };
};
