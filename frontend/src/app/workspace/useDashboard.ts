import { useCallback, useEffect, useState } from 'react';
import { useAuthUser } from '@app/auth/useAuthUser';
import { WIDGETS } from './widget-registry';

const KEY = (email: string) => `vera:dashboard:${email || 'anon'}`;
const defaultLayout = () => WIDGETS.filter((w) => w.defaultEnabled).map((w) => w.id);

/** Dashboard Engine: enabled + ordered widgets, persisted per user (localStorage).
 * Preparado para resize futuro (el registry ya tiene `size`). */
export const useDashboard = () => {
  const { email } = useAuthUser();
  const [layout, setLayout] = useState<string[]>(defaultLayout);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(email));
      if (raw) {
        const ids = (JSON.parse(raw) as string[]).filter((id) => WIDGETS.some((w) => w.id === id));
        setLayout(ids.length ? ids : defaultLayout());
        return;
      }
    } catch {
      /* ignore */
    }
    setLayout(defaultLayout());
  }, [email]);

  const persist = useCallback(
    (next: string[]) => {
      setLayout(next);
      try {
        localStorage.setItem(KEY(email), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [email],
  );

  const isEnabled = (id: string) => layout.includes(id);
  const toggle = (id: string) =>
    persist(isEnabled(id) ? layout.filter((x) => x !== id) : [...layout, id]);
  const move = (id: string, dir: -1 | 1) => {
    const i = layout.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.length) return;
    const next = [...layout];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  };
  const reset = () => persist(defaultLayout());

  return { layout, isEnabled, toggle, move, reset };
};
