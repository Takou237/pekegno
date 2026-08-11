import { client } from './client';
import type { ClientListItem, ClientListParams, ClientPayload } from '@/types/client';
import type { PaginatedResponse } from '@/types/agency';

export const clientsApi = {
  async list(params: ClientListParams = {}): Promise<PaginatedResponse<ClientListItem>> {
    const { data } = await client.get<PaginatedResponse<ClientListItem>>('/clients', { params });
    return data;
  },

  async create(payload: ClientPayload): Promise<ClientListItem> {
    const { data } = await client.post<ClientListItem>('/clients', payload);
    return data;
  },

  async get(id: string): Promise<ClientListItem> {
    const { data } = await client.get<ClientListItem>(`/clients/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<ClientPayload>): Promise<ClientListItem> {
    const { data } = await client.put<ClientListItem>(`/clients/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/clients/${id}`);
  },

  async search(q: string): Promise<ClientListItem[]> {
    const { data } = await client.get<ClientListItem[]>('/clients/search', { params: { q } });
    return data;
  },
};
