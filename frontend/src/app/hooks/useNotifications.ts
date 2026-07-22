import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '@vera/config';

const BASE = `${env.backendUrl}/api/notifications`;

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  documentId?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  unread: number;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<NotificationsResponse> => {
      const res = await fetch(BASE);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    refetchInterval: 20000,
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => fetch(`${BASE}/read-all`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  return { markRead, markAll };
}
