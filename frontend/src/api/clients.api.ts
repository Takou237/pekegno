import { client } from './client';
import type { UserListItem } from '@/types/user';
import type { PaginatedResponse } from '@/types/agency';

export interface ClientListParams {
  search?: string;
  is_active?: boolean;
  per_page?: number;
  page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const clientsApi = {
  async list(params: ClientListParams = {}): Promise<PaginatedResponse<UserListItem>> {
    const { data } = await client.get<PaginatedResponse<UserListItem>>('/clients', { params });
    return data;
  },

  async get(id: string): Promise<UserListItem> {
    const { data } = await client.get<UserListItem>(`/clients/${id}`);
    return data;
  },

  async update(id: string, payload: { is_active?: boolean }): Promise<UserListItem> {
    const { data } = await client.put<UserListItem>(`/clients/${id}`, payload);
    return data;
  },
};
