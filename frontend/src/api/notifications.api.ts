import { client } from './client';
import type { AppNotification } from '@/types/notification';

export const notificationsApi = {
  async list(limit = 50): Promise<AppNotification[]> {
    const { data } = await client.get<AppNotification[]>('/notifications', {
      params: { limit },
    });
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await client.get<{ count: number }>('/notifications/unread-count');
    return data.count;
  },

  async markRead(id: string): Promise<AppNotification> {
    const { data } = await client.post<AppNotification>(`/notifications/${id}/read`);
    return data;
  },

  async readAll(): Promise<void> {
    await client.post('/notifications/read-all');
  },
};
