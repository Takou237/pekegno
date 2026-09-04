import { client } from './client';
import type {
  CommissionBeneficiarySummary,
  CommissionPayment,
  CommissionPaymentPayload,
  CommissionRule,
  CommissionRulePayload,
  CommissionEntry,
  CommissionEntryListParams,
  CommissionEntryListResponse,
} from '@/types/commissions';

export const commissionsApi = {
  listRules(): Promise<CommissionRule[]> {
    return client.get('/commission-rules').then((r) => r.data);
  },

  createRule(payload: CommissionRulePayload): Promise<CommissionRule> {
    return client.post('/commission-rules', payload).then((r) => r.data);
  },

  updateRule(id: string, payload: CommissionRulePayload): Promise<CommissionRule> {
    return client.put(`/commission-rules/${id}`, payload).then((r) => r.data);
  },

  ruleVersions(id: string): Promise<CommissionRule[]> {
    return client.get(`/commission-rules/${id}/versions`).then((r) => r.data);
  },

  deactivateRule(id: string): Promise<void> {
    return client.delete(`/commission-rules/${id}`).then((r) => r.data);
  },

  listEntries(params?: CommissionEntryListParams): Promise<CommissionEntryListResponse> {
    return client.get('/commissions/entries', { params }).then((r) => r.data);
  },

  createEntry(payload: {
    seller_profile_id: string;
    category: 'training' | 'service';
    amount: number;
    label?: string;
    invoice_id?: string;
  }): Promise<CommissionEntry> {
    return client.post('/commissions/entries', payload).then((r) => r.data);
  },

  updateEntryAmount(id: string, payload: { amount: number; label?: string }): Promise<CommissionEntry> {
    return client.put(`/commissions/entries/${id}`, payload).then((r) => r.data);
  },

  validateEntry(id: string): Promise<CommissionEntry> {
    return client.post(`/commissions/entries/${id}/validate`).then((r) => r.data);
  },

  payEntry(id: string, payload?: { payment_method?: string }): Promise<CommissionEntry> {
    return client.post(`/commissions/entries/${id}/pay`, payload).then((r) => r.data);
  },

  cancelEntry(id: string): Promise<CommissionEntry> {
    return client.post(`/commissions/entries/${id}/cancel`).then((r) => r.data);
  },

  recalculateSeller(profileId: string): Promise<{ created: number; payments: number; invoices: number }> {
    return client.post(`/commissions/seller-profiles/${profileId}/recalculate`).then((r) => r.data.data);
  },

  summaryBeneficiaries(params?: { agency_id?: string; search?: string }): Promise<CommissionBeneficiarySummary> {
    return client.get('/commission-payments/summary', { params }).then((r) => r.data);
  },

  payCommission(payload: CommissionPaymentPayload): Promise<CommissionPayment> {
    return client.post('/commission-payments', payload).then((r) => r.data);
  },
};
