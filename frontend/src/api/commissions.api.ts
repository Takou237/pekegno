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
  listRules(params?: { basis?: string; role_id?: string; is_active?: boolean }): Promise<CommissionRule[]> {
    return client.get('/commission-rules', { params }).then((r) => r.data);
  },

  /** Règles attribuées à un rôle (groupes de règles). */
  syncRoleRules(roleId: string, ruleGroupIds: string[]): Promise<string[]> {
    return client.put(`/roles/${roleId}/commission-rules`, { rule_group_ids: ruleGroupIds }).then((r) => r.data.data);
  },

  /** Calcule les primes mensuelles (CA par paliers, croissance) d'un mois YYYY-MM. */
  computePeriod(period: string, ruleId?: string): Promise<{ created: number; updated: number; rows: { rule: string; user: string; base: number; amount: number }[] }> {
    return client.post('/commission-rules/compute-period', { period, rule_id: ruleId }).then((r) => r.data.data);
  },

  /** Prime manuelle (témoignage, qualité…) dans la fourchette de la règle. */
  awardManual(ruleId: string, payload: { user_id: string; amount: number; label?: string }): Promise<CommissionEntry> {
    return client.post(`/commission-rules/${ruleId}/award`, payload).then((r) => r.data);
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
