import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type {
  AvailableUser,
  Commercial,
  CommercialListParams,
  CommercialPayload,
  CommercialStats,
  RankingEntry,
} from '@/types/commercial';

export const commercialsApi = {
  async list(params: CommercialListParams = {}): Promise<PaginatedResponse<Commercial>> {
    const { data } = await client.get<PaginatedResponse<Commercial>>('/commercials', { params });
    return data;
  },

  async create(payload: CommercialPayload): Promise<Commercial> {
    const { data } = await client.post<Commercial>('/commercials', payload);
    return data;
  },

  async get(id: string): Promise<Commercial> {
    const { data } = await client.get<Commercial>(`/commercials/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<CommercialPayload>): Promise<Commercial> {
    const { data } = await client.put<Commercial>(`/commercials/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/commercials/${id}`);
  },

  async search(q: string): Promise<Commercial[]> {
    const { data } = await client.get<Commercial[]>('/commercials/search', { params: { q } });
    return data;
  },

  async availableUsers(): Promise<AvailableUser[]> {
    const { data } = await client.get<AvailableUser[]>('/commercials/available-users');
    return data;
  },

  async adjustPoints(
    id: string,
    points: number,
    reason?: string
  ): Promise<{ message: string; points_balance: number }> {
    const { data } = await client.post<{ message: string; points_balance: number }>(
      `/commercials/${id}/points`,
      { points, reason }
    );
    return data;
  },

  async ranking(params: { from?: string; to?: string; limit?: number } = {}): Promise<RankingEntry[]> {
    const { data } = await client.get<RankingEntry[]>('/commercials/ranking', { params });
    return data;
  },

  async stats(id: string, params: { from?: string; to?: string } = {}): Promise<CommercialStats> {
    const { data } = await client.get<CommercialStats>(`/commercials/${id}/stats`, { params });
    return data;
  },
};
