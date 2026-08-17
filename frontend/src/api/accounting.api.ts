import { client } from './client';
import type { PaginatedResponse } from '@/types/agency';
import type {
  AccountingCategory,
  AccountingCategoryPayload,
  AccountingListParams,
  AccountingTransaction,
  AccountingTransactionPayload,
} from '@/types/accounting';

export interface AccountingListResponse {
  transactions: PaginatedResponse<AccountingTransaction>;
  totals: { income: number; expense: number; balance: number };
}

export const accountingApi = {
  async list(params: AccountingListParams = {}): Promise<AccountingListResponse> {
    const { data } = await client.get<AccountingListResponse>('/accounting/transactions', { params });
    return data;
  },

  async create(payload: AccountingTransactionPayload): Promise<AccountingTransaction> {
    const { data } = await client.post<AccountingTransaction>('/accounting/transactions', payload);
    return data;
  },

  async update(id: string, payload: Partial<AccountingTransactionPayload>): Promise<AccountingTransaction> {
    const { data } = await client.put<AccountingTransaction>(`/accounting/transactions/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/accounting/transactions/${id}`);
  },

  async categories(): Promise<AccountingCategory[]> {
    const { data } = await client.get<AccountingCategory[]>('/accounting/categories');
    return data;
  },

  async createCategory(payload: AccountingCategoryPayload): Promise<AccountingCategory> {
    const { data } = await client.post<AccountingCategory>('/accounting/categories', payload);
    return data;
  },

  async updateCategory(id: string, payload: Partial<AccountingCategoryPayload>): Promise<AccountingCategory> {
    const { data } = await client.put<AccountingCategory>(`/accounting/categories/${id}`, payload);
    return data;
  },

  async removeCategory(id: string): Promise<void> {
    await client.delete(`/accounting/categories/${id}`);
  },
};
