import { client } from './client';
import type {
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

  validateEntry(id: string): Promise<CommissionEntry> {
    return client.post(`/commissions/entries/${id}/validate`).then((r) => r.data);
  },

  payEntry(id: string): Promise<CommissionEntry> {
    return client.post(`/commissions/entries/${id}/pay`).then((r) => r.data);
  },

  cancelEntry(id: string): Promise<CommissionEntry> {
    return client.post(`/commissions/entries/${id}/cancel`).then((r) => r.data);
  },
};
