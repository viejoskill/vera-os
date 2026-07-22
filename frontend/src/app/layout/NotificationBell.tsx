import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, FileSignature } from 'lucide-react';
import { useNotifications, useNotificationActions } from '@app/hooks/useNotifications';

/** Campanita de notificaciones in-app de VERA (aviso nativo, sin proveedores). */
export const NotificationBell = () => {
  const { data } = useNotifications();
  const { markRead, markAll } = useNotificationActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = (id: string, link?: string | null) => {
    markRead.mutate(id);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className="vera-notif" ref={ref}>
      <button
        type="button"
        className="vera-notif__bell"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        data-testid="notif-bell"
      >
        <Bell size={18} />
        {unread > 0 && <span className="vera-notif__dot" data-testid="notif-badge">{unread}</span>}
      </button>

      {open && (
        <div className="vera-notif__panel" data-testid="notif-panel">
          <div className="vera-notif__head">
            <span>Notificaciones</span>
            {unread > 0 && (
              <button type="button" className="vera-notif__mark" onClick={() => markAll.mutate()} data-testid="notif-mark-all">
                <Check size={14} /> Marcar leídas
              </button>
            )}
          </div>
          {items.length === 0 && <p className="vera-notif__empty">No tenés notificaciones.</p>}
          <ul className="vera-notif__list">
            {items.map((n) => (
              <li
                key={n.id}
                className={`vera-notif__item ${n.read ? '' : 'is-unread'}`}
                onClick={() => openItem(n.id, n.link)}
                data-testid={`notif-item-${n.id}`}
              >
                <FileSignature size={16} className="vera-notif__ic" />
                <div className="vera-notif__body">
                  <span className="vera-notif__title">{n.title}</span>
                  <span className="vera-notif__msg">{n.message}</span>
                  <span className="vera-notif__at">{new Date(n.createdAt).toLocaleString('es-AR')}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
