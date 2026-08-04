import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type { Promotion, PromotionListParams, PromotionPayload } from '@/types/promotion';

export const promotionsApi = {
  async list(params: PromotionListParams = {}): Promise<PaginatedResponse<Promotion>> {
    const { data } = await client.get<PaginatedResponse<Promotion>>('/promotions', { params });
    return data;
  },

  async create(serviceId: string, payload: PromotionPayload): Promise<Promotion> {
    const { data } = await client.post<Promotion>(`/services/${serviceId}/promotions`, payload);
    return data;
  },

  async update(id: string, payload: PromotionPayload): Promise<Promotion> {
    const { data } = await client.put<Promotion>(`/promotions/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/promotions/${id}`);
  },
};
