import { client } from './client';
import type {
  CreateInvoicePayload,
  Invoice,
  InvoiceListParams,
  InvoiceTotals,
  PayInvoicePayload,
  RejectInvoicePayload,
  UpdateInvoicePayload,
} from '@/types/invoice';
import type { PaginatedResponse } from '@/types/agency';

export interface InvoiceIndexResponse {
  invoices: PaginatedResponse<Invoice>;
  totals: InvoiceTotals;
}

export const invoicesApi = {
  async list(params: InvoiceListParams = {}): Promise<InvoiceIndexResponse> {
    const { data } = await client.get<InvoiceIndexResponse>('/invoices', { params });
    return data;
  },

  async create(payload: CreateInvoicePayload): Promise<Invoice> {
    const { data } = await client.post<Invoice>('/invoices', payload);
    return data;
  },

  async get(id: string): Promise<Invoice> {
    const { data } = await client.get<Invoice>(`/invoices/${id}`);
    return data;
  },

  async update(id: string, payload: UpdateInvoicePayload): Promise<Invoice> {
    const { data } = await client.put<Invoice>(`/invoices/${id}`, payload);
    return data;
  },

  async pay(id: string, payload: PayInvoicePayload): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/payments`, payload);
    return data;
  },

  async cancel(id: string): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/cancel`);
    return data;
  },

  async validate(id: string): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/validate`);
    return data;
  },

  async reject(id: string, payload: RejectInvoicePayload): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/reject`, payload);
    return data;
  },
};
