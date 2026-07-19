import { useCallback, useEffect, useState } from 'react';
import { useAuthUser } from '@app/auth/useAuthUser';
import { QUICK_ACTIONS } from './quick-actions-catalog';

const KEY = (email: string) => `vera:quickactions:${email || 'anon'}`;
const defaultPins = () => QUICK_ACTIONS.filter((a) => a.defaultPinned).map((a) => a.id);

/** Acciones Rápidas fijadas por el usuario, persistido en localStorage.
 * Personalizable (fijar/quitar); el reorden por arrastre llegará después. */
export const useQuickActions = () => {
  const { email } = useAuthUser();
  const [pinned, setPinned] = useState<string[]>(defaultPins);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(email));
      if (raw) {
        const ids = (JSON.parse(raw) as string[]).filter((id) =>
          QUICK_ACTIONS.some((a) => a.id === id),
        );
        setPinned(ids);
        return;
      }
    } catch {
      /* ignore */
    }
    setPinned(defaultPins());
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
  const reset = () => persist(defaultPins());

  return { pinned, isPinned, toggle, reset };
};
