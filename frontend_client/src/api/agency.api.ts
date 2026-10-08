import { client } from './client';

export interface ClientPrestationAction {
  id: string;
  type: string;
  title: string;
  platform: string | null;
  quantity: number;
  frequency: 'per_day' | 'per_week' | 'per_month' | 'once';
  unit: string | null;
  status: string;
  due_date: string | null;
  my_review: { rating: number; comment: string | null; updated_at: string } | null;
  can_rate: boolean;
}

export interface ClientPrestation {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  status: 'validated' | 'in_progress' | 'completed' | 'suspended';
  start_date: string;
  end_date: string;
  package: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  contract: { id: string; number: string; status: string } | null;
  rating_avg: number | null;
  rating_count: number;
  client_direct_rating: number | null;
  client_direct_comment: string | null;
  client_direct_rated_at: string | null;
  display_rating_avg: number | null;
  display_rating_count: number;
  can_rate: boolean;
  actions_count?: number | null;
  rating_summary?: {
    avg: number | null;
    count: number;
    distribution: Record<string, number>;
    has_direct_rating: boolean;
    direct_rating: number | null;
  };
  actions?: ClientPrestationAction[];
}

export interface ClientNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

/** Portail client — Agency : mes prestations, notation 5★ par action, notifications. */
export const agencyApi = {
  async prestations(): Promise<ClientPrestation[]> {
    const { data } = await client.get<{ data: ClientPrestation[] }>('/client/prestations');
    return data.data;
  },
  async prestation(id: string): Promise<ClientPrestation> {
    const { data } = await client.get<ClientPrestation>(`/client/prestations/${id}`);
    return data;
  },
  /** Crée OU modifie ma note sur une action (une seule note par action). */
  async rateAction(actionId: string, rating: number, comment?: string) {
    const { data } = await client.put(`/client/prestation-actions/${actionId}/review`, { rating, comment: comment || null });
    return data as { prestation: { rating_avg: number | null; rating_count: number } };
  },
  /** N4/D23 : note globale directe sur la prestation (modifiable). */
  async ratePrestation(prestationId: string, rating: number, comment?: string) {
    const { data } = await client.put(`/client/prestations/${prestationId}/review`, { rating, comment: comment || null });
    return data as {
      review: { rating: number; comment: string | null; updated_at: string | null };
      rating_summary: { avg: number | null; count: number; has_direct_rating: boolean; direct_rating: number | null };
      display_rating: { avg: number | null; count: number };
    };
  },
  async notifications(): Promise<{ data: ClientNotification[]; unread_count: number }> {
    const { data } = await client.get('/client/notifications');
    return data;
  },
  async markRead(id: string): Promise<void> {
    await client.post(`/client/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await client.post('/client/notifications/read-all');
  },
};
