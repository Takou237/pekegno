import { client } from './client';
import type {
  Agency,
  AgencyListParams,
  AgencyPayload,
  PaginatedResponse,
} from '@/types/agency';

export const agenciesApi = {
  async list(params: AgencyListParams = {}, opts: { silentForbidden?: boolean } = {}): Promise<PaginatedResponse<Agency>> {
    const { data } = await client.get<PaginatedResponse<Agency>>('/agencies', { params, silentForbidden: opts.silentForbidden });
    return data;
  },

  async get(id: string, opts: { silentForbidden?: boolean } = {}): Promise<Agency> {
    const { data } = await client.get<Agency>(`/agencies/${id}`, { silentForbidden: opts.silentForbidden });
    return data;
  },

  async create(payload: AgencyPayload): Promise<Agency> {
    const { data } = await client.post<Agency>('/agencies', payload);
    return data;
  },

  async update(id: string, payload: Partial<AgencyPayload>): Promise<Agency> {
    const { data } = await client.put<Agency>(`/agencies/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/agencies/${id}`);
  },

  async trash(params: AgencyListParams = {}): Promise<PaginatedResponse<Agency>> {
    const { data } = await client.get<PaginatedResponse<Agency>>('/agencies/trash', {
      params,
    });
    return data;
  },

  async restore(id: string): Promise<Agency> {
    const { data } = await client.post<Agency>(`/agencies/${id}/restore`);
    return data;
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/agencies/${id}/force-delete`);
  },
};
