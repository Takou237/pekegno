import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { Commercial, CommercialListParams, CommercialPayload, CommercialStats } from '@/types/commercial';

function employeeParams(params: CommercialListParams = {}): CommercialListParams {
  return { ...params, kind: 'employe' as const };
}

export const employeesApi = {
  async list(params: CommercialListParams = {}): Promise<PaginatedResponse<Commercial>> {
    const { data } = await client.get<PaginatedResponse<Commercial>>('/employees', { params: employeeParams(params) });
    return data;
  },

  async create(payload: CommercialPayload): Promise<Commercial> {
    const { data } = await client.post<Commercial>('/employees', { ...payload, kind: 'employe' });
    return data;
  },

  async get(id: string): Promise<Commercial> {
    const { data } = await client.get<Commercial>(`/employees/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<CommercialPayload>): Promise<Commercial> {
    const { data } = await client.put<Commercial>(`/employees/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/employees/${id}`);
  },

  async search(q: string): Promise<Commercial[]> {
    const { data } = await client.get<Commercial[]>('/employees/search', { params: { q } });
    return data;
  },

  async availableUsers(): Promise<{ id: string; first_name: string | null; last_name: string | null; email: string; is_active: boolean }[]> {
    const { data } = await client.get('/employees/available-users');
    return data;
  },

  async stats(id: string, params: { from?: string; to?: string } = {}): Promise<CommercialStats> {
    const { data } = await client.get<CommercialStats>(`/employees/${id}/stats`, { params });
    return data;
  },

  async adjustPoints(id: string, points: number, reason?: string): Promise<{ message: string; points_balance: number }> {
    const { data } = await client.post(`/employees/${id}/points`, { points, reason });
    return data;
  },

  async ranking(params: { limit?: number } = {}): Promise<import('@/types/commercial').RankingEntry[]> {
    const { data } = await client.get<import('@/types/commercial').RankingEntry[]>('/employees/ranking', { params });
    return data;
  },
};
