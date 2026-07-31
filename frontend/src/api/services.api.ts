import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { Category } from '@/types/category';
import type {
  Promotion,
  PromotionPayload,
  Service,
  ServiceListParams,
  ServicePayload,
} from '@/types/service';

export const categoriesApi = {
  async list(): Promise<Category[]> {
    const { data } = await client.get<Category[]>('/categories');
    return data;
  },
};

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
    const { data } = await client.get<PaginatedResponse<Service>>('/services/trash', { params });
    return data;
  },

  async restore(id: string): Promise<Service> {
    const { data } = await client.post<Service>(`/services/${id}/restore`);
    return data;
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/services/${id}/force-delete`);
  },
};

export const promotionsApi = {
  async listForService(serviceId: string): Promise<Promotion[]> {
    const { data } = await client.get<Promotion[]>(`/services/${serviceId}/promotions`);
    return data;
  },

  async listAll(params: { service_id?: string; status?: 'active' | 'expired'; per_page?: number } = {}): Promise<PaginatedResponse<Promotion>> {
    const { data } = await client.get<PaginatedResponse<Promotion>>('/promotions', { params });
    return data;
  },

  async create(serviceId: string, payload: PromotionPayload): Promise<Promotion> {
    const { data } = await client.post<Promotion>(`/services/${serviceId}/promotions`, payload);
    return data;
  },

  async update(id: string, payload: Partial<PromotionPayload>): Promise<Promotion> {
    const { data } = await client.put<Promotion>(`/promotions/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/promotions/${id}`);
  },
};
