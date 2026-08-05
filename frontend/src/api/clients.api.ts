import { client } from './client';
import type { ClientListItem, ClientListParams, ClientPayload } from '@/types/client';
import type { PaginatedResponse } from '@/types/agency';

export const clientsApi = {
  async list(params: ClientListParams = {}): Promise<PaginatedResponse<ClientListItem>> {
    const { data } = await client.get<PaginatedResponse<ClientListItem>>('/clients', { params });
    return data;
  },

  async create(payload: ClientPayload): Promise<ClientListItem> {
    const { data } = await client.post<{ data: ClientListItem }>('/clients', payload);
    return data.data;
  },

  async get(id: string): Promise<ClientListItem> {
    const { data } = await client.get<{ data: ClientListItem }>(`/clients/${id}`);
    return data.data;
  },

  async update(id: string, payload: Partial<ClientPayload>): Promise<ClientListItem> {
    const { data } = await client.put<{ data: ClientListItem }>(`/clients/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/clients/${id}`);
  },

  async search(q: string): Promise<ClientListItem[]> {
    const { data } = await client.get<ClientListItem[]>('/clients/search', { params: { q } });
    return data;
  },
};
