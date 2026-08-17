import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type {
  Subscription,
  SubscriptionPack,
  SubscriptionPackPayload,
  SubscriptionListParams,
  CreateSubscriptionPayload,
} from '@/types/subscription';

export const subscriptionsApi = {
  async list(params: SubscriptionListParams = {}): Promise<PaginatedResponse<Subscription>> {
    const { data } = await client.get<PaginatedResponse<Subscription>>('/subscriptions', { params });
    return data;
  },

  async get(id: string): Promise<Subscription> {
    const { data } = await client.get<Subscription>(`/subscriptions/${id}`);
    return data;
  },

  async create(payload: CreateSubscriptionPayload): Promise<Subscription> {
    const { data } = await client.post<Subscription>('/subscriptions', payload);
    return data;
  },

  async renew(id: string): Promise<Subscription> {
    const { data } = await client.post<Subscription>(`/subscriptions/${id}/renew`);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/subscriptions/${id}`);
  },

  async packs(params: { agency_id?: string; per_page?: number } = {}): Promise<PaginatedResponse<SubscriptionPack>> {
    const { data } = await client.get<PaginatedResponse<SubscriptionPack>>('/subscription-packs', { params });
    return data;
  },

  async createPack(payload: SubscriptionPackPayload): Promise<SubscriptionPack> {
    const { data } = await client.post<SubscriptionPack>('/subscription-packs', payload);
    return data;
  },

  async updatePack(id: string, payload: Partial<SubscriptionPackPayload>): Promise<SubscriptionPack> {
    const { data } = await client.put<SubscriptionPack>(`/subscription-packs/${id}`, payload);
    return data;
  },

  async removePack(id: string): Promise<void> {
    await client.delete(`/subscription-packs/${id}`);
  },
};
