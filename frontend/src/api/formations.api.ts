import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { Formation, FormationPayload } from '@/types/formation';

export interface FormationListParams {
  search?: string;
  category_id?: string;
  per_page?: number;
  page?: number;
}

export const formationsApi = {
  async list(params: FormationListParams = {}): Promise<PaginatedResponse<Formation>> {
    const { data } = await client.get<PaginatedResponse<Formation>>('/formations', { params });
    return data;
  },

  async get(id: string): Promise<Formation> {
    const { data } = await client.get<Formation>(`/formations/${id}`);
    return data;
  },

  async create(payload: FormationPayload): Promise<Formation> {
    const { data } = await client.post<Formation>('/formations', payload);
    return data;
  },

  async update(id: string, payload: Partial<FormationPayload>): Promise<Formation> {
    const { data } = await client.put<Formation>(`/formations/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/formations/${id}`);
  },
};
