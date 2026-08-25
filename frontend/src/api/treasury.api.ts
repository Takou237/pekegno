import { apiClient } from './client';
import type {
  TreasuryAccount,
  TreasuryAccountListParams,
  TreasuryTransaction,
  TreasuryTransactionListParams,
  TreasuryTransactionsResponse,
  TransferPayload,
} from '@/types/treasury';

export const treasuryApi = {
  listAccounts(params?: TreasuryAccountListParams): Promise<TreasuryAccount[]> {
    return apiClient.get('/treasury/accounts', { params }).then((r) => r.data);
  },

  getAccount(id: string): Promise<TreasuryAccount> {
    return apiClient.get(`/treasury/accounts/${id}`).then((r) => r.data);
  },

  listTransactions(params?: TreasuryTransactionListParams): Promise<TreasuryTransactionsResponse> {
    return apiClient.get('/treasury/transactions', { params }).then((r) => r.data);
  },

  transfer(payload: TransferPayload): Promise<{
    message: string;
    reference: string;
    out: TreasuryTransaction;
    in: TreasuryTransaction;
  }> {
    return apiClient.post('/treasury/transfer', payload).then((r) => r.data);
  },
};
