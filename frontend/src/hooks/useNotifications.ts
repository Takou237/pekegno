import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '@/api/notifications.api';
import type { AppNotification } from '@/types/notification';

const POLL_INTERVAL_MS = 30000;

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list(50),
        notificationsApi.unreadCount(),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      // silencieux — l'UI du badge ne doit pas casser sur une erreur réseau
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [load]);

  const markRead = useCallback(
    async (id: string) => {
      await notificationsApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString(), is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [],
  );

  const readAll = useCallback(async () => {
    await notificationsApi.readAll();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString(), is_read: true })));
    setUnreadCount(0);
  }, []);

  return { items, unreadCount, loading, markRead, readAll, refresh: load };
}
