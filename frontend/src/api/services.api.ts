import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { Service, ServiceListParams, ServicePayload, ServiceSearchItem } from '@/types/service';

export const servicesApi = {
  async list(params: ServiceListParams = {}): Promise<PaginatedResponse<Service>> {
    const { data } = await client.get<PaginatedResponse<Service>>('/services', { params });
    return data;
  },

  async get(id: string): Promise<Service> {
    const { data } = await client.get<Service>(`/services/${id}`);
    return data;
  },

  async create(payload: ServicePayload): Promise<Service> {
    const { data } = await client.post<Service>('/services', payload);
    return data;
  },

  async update(id: string, payload: Partial<ServicePayload>): Promise<Service> {
    const { data } = await client.put<Service>(`/services/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/services/${id}`);
  },

  async trash(params: ServiceListParams = {}): Promise<PaginatedResponse<Service>> {
    const { data } = await client.get<PaginatedResponse<Service>>('/services/trash', {
      params,
    });
    return data;
  },

  async restore(id: string): Promise<Service> {
    const { data } = await client.post<Service>(`/services/${id}/restore`);
    return data;
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/services/${id}/force-delete`);
  },

  async search(q: string): Promise<ServiceSearchItem[]> {
    const { data } = await client.get<ServiceSearchItem[]>('/services/search', { params: { q } });
    return data;
  },
};
