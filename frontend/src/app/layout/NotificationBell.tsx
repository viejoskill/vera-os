import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, FileSignature, CalendarClock, BadgeCheck, Wallet } from 'lucide-react';
import { useNotifications, useNotificationActions } from '@app/hooks/useNotifications';

/** Campanita de notificaciones in-app de VERA (aviso nativo, sin proveedores). */
export const NotificationBell = () => {
  const { data } = useNotifications();
  const { markRead, markAll } = useNotificationActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
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

      {open && (createPortal(
        <div className="vera-notif__panel" data-testid="notif-panel" ref={panelRef}>
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
                {n.type === 'reserva_proxima' || n.type === 'reserva_hoy' ? <CalendarClock size={16} className="vera-notif__ic" />
                  : n.type === 'sena_pagada' ? <BadgeCheck size={16} className="vera-notif__ic" />
                  : n.type === 'saldo_pendiente' ? <Wallet size={16} className="vera-notif__ic" />
                  : <FileSignature size={16} className="vera-notif__ic" />}
                <div className="vera-notif__body">
                  <span className="vera-notif__title">{n.title}</span>
                  <span className="vera-notif__msg">{n.message}</span>
                  <span className="vera-notif__at">{new Date(n.createdAt).toLocaleString('es-AR')}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      ) as ReactNode)}
    </div>
  );
};

