import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { ConvertedClient, Prospect, ProspectListParams, ProspectPayload } from '@/types/prospect';

export const prospectsApi = {
  async list(params: ProspectListParams = {}): Promise<PaginatedResponse<Prospect>> {
    const { data } = await client.get<PaginatedResponse<Prospect>>('/prospects', { params });
    return data;
  },

  async create(payload: ProspectPayload): Promise<Prospect> {
    const { data } = await client.post<Prospect>('/prospects', payload);
    return data;
  },

  async get(id: string): Promise<Prospect> {
    const { data } = await client.get<Prospect>(`/prospects/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<ProspectPayload>): Promise<Prospect> {
    const { data } = await client.put<Prospect>(`/prospects/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/prospects/${id}`);
  },

  async convert(id: string): Promise<ConvertedClient> {
    const { data } = await client.post<ConvertedClient>(`/prospects/${id}/convert`);
    return data;
  },
};
