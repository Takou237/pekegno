import { client } from './client';
import type { Paginated } from './academy.api';
import type { SellerProfile, SellerProfilePayload, CommissionSummary } from '@/types/formation';

export interface CommissionEntry {
  id: string;
  invoice_id: string;
  seller_profile_id: string | null;
  beneficiary_commercial_id: string | null;
  base_amount: number;
  amount: number;
  category: 'training' | 'service';
  product_id: string | null;
  product_type: 'course' | 'service' | null;
  status: 'calculated' | 'validated' | 'paid' | 'cancelled';
  created_at: string;
  invoice?: { id: string; number: string; total_amount: number };
}

export interface CommissionPayment {
  id: string;
  seller_profile_id: string | null;
  commercial_id: string | null;
  commission_entry_id: string | null;
  amount: number;
  created_at: string;
  commissionEntry?: CommissionEntry;
}

export const sellerProfilesApi = {
  async list(params: { agency_id?: string; kind?: string; per_page?: number; page?: number } = {}): Promise<Paginated<SellerProfile>> {
    const { data } = await client.get<Paginated<SellerProfile>>('/seller-profiles', { params });
    return data;
  },

  async create(payload: SellerProfilePayload): Promise<SellerProfile> {
    const { data } = await client.post<SellerProfile>('/seller-profiles', payload);
    return data;
  },

  async get(id: string): Promise<SellerProfile> {
    const { data } = await client.get<SellerProfile>(`/seller-profiles/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<SellerProfilePayload>): Promise<SellerProfile> {
    const { data } = await client.put<SellerProfile>(`/seller-profiles/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/seller-profiles/${id}`);
  },

  async commissions(id: string): Promise<{ summary: CommissionSummary; entries: Paginated<CommissionEntry>; payments: Paginated<CommissionPayment> }> {
    const { data } = await client.get(`/seller-profiles/${id}/commissions`);
    return data;
  },

  async payCommission(id: string, payload: { amount: number; treasury_account_id?: string; commission_entry_id?: string; payment_method?: string; note?: string }): Promise<CommissionPayment> {
    const { data } = await client.post<CommissionPayment>(`/seller-profiles/${id}/pay`, payload);
    return data;
  },
};
