import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type {
  CreateOrderPayload,
  DeclineOrderPayload,
  Order,
  OrderListParams,
  OrderStatus,
  SubmitOrderPayload,
  ValidateOrderPayload,
} from '@/types/order';
import type { Invoice } from '@/types/invoice';

export const ordersApi = {
  async list(params: OrderListParams = {}): Promise<PaginatedResponse<Order>> {
    const { data } = await client.get<PaginatedResponse<Order>>('/orders', { params });
    return data;
  },

  async get(id: string): Promise<Order> {
    const { data } = await client.get<Order>(`/orders/${id}`);
    return data;
  },

  async create(payload: CreateOrderPayload): Promise<Order> {
    const { data } = await client.post<Order>('/orders', payload);
    return data;
  },

  async update(id: string, payload: Partial<CreateOrderPayload>): Promise<Order> {
    const { data } = await client.put<Order>(`/orders/${id}`, payload);
    return data;
  },

  async submit(id: string, payload: SubmitOrderPayload = {}): Promise<Order> {
    const { data } = await client.post<Order>(`/orders/${id}/submit`, payload);
    return data;
  },

  async validateSubmission(id: string, payload: ValidateOrderPayload = {}): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/orders/${id}/validate`, payload);
    return data;
  },

  async decline(id: string, payload: DeclineOrderPayload = {}): Promise<Order> {
    const { data } = await client.post<Order>(`/orders/${id}/decline`, payload);
    return data;
  },

  async generateInvoice(id: string): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/orders/${id}/invoice`);
    return data;
  },

  async confirm(id: string): Promise<Order> {
    const { data } = await client.post<Order>(`/orders/${id}/confirm`);
    return data;
  },

  async destroy(id: string): Promise<void> {
    await client.delete(`/orders/${id}`);
  },
};

export type { OrderStatus };
