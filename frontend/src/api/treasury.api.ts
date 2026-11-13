import { client } from './client';
import type {
  CashClosing,
  CashJourney,
  CashClosingListParams,
  CloseCashPayload,
  TreasuryAccount,
  TreasuryAccountCreatePayload,
  TreasuryAccountListParams,
  TreasuryTransaction,
  TreasuryTransactionListParams,
  TreasuryTransactionsResponse,
  TransferPayload,
} from '@/types/treasury';

export const treasuryApi = {
  // Nouvelle caisse : crée aussi le moyen de paiement correspondant.
  createAccount(payload: TreasuryAccountCreatePayload): Promise<TreasuryAccount> {
    return client.post('/treasury/accounts', payload).then((r) => r.data);
  },

  updateAccount(id: string, payload: { name?: string; is_active?: boolean; visible_to_cashier?: boolean }): Promise<TreasuryAccount> {
    return client.put(`/treasury/accounts/${id}`, payload).then((r) => r.data);
  },

  listAccounts(params?: TreasuryAccountListParams): Promise<TreasuryAccount[]> {
    return client.get('/treasury/accounts', { params }).then((r) => r.data);
  },

  getAccount(id: string): Promise<TreasuryAccount> {
    return client.get(`/treasury/accounts/${id}`).then((r) => r.data);
  },

  listTransactions(params?: TreasuryTransactionListParams): Promise<TreasuryTransactionsResponse> {
    return client.get('/treasury/transactions', { params }).then((r) => r.data);
  },

  transfer(payload: TransferPayload): Promise<{
    message: string;
    reference: string;
    out: TreasuryTransaction;
    in: TreasuryTransaction;
  }> {
    return client.post('/treasury/transfer', payload).then((r) => r.data);
  },

  listClosings(params?: CashClosingListParams): Promise<CashClosing[]> {
    return client.get('/treasury/closings', { params }).then((r) => r.data);
  },

  /** Journée d'une caisse avant clôture : solde initial, entrées, sorties, transferts, théorique. */
  /** Journée en cours de la caisse (depuis sa dernière clôture), ou journée clôturée si elle est fermée. */
  closingDay(params: { treasury_account_id: string }): Promise<CashJourney> {
    return client.get('/treasury/closings/day', { params }).then((r) => r.data);
  },

  /** Rouvre la caisse : une nouvelle journée commence au solde final de la clôture. */
  reopenCash(accountId: string): Promise<CashClosing> {
    return client.post(`/treasury/accounts/${accountId}/reopen`).then((r) => r.data);
  },

  closeCash(payload: CloseCashPayload): Promise<CashClosing> {
    return client.post('/treasury/closings', payload).then((r) => r.data);
  },

  validateClosing(id: string): Promise<CashClosing> {
    return client.post(`/treasury/closings/${id}/validate`).then((r) => r.data);
  },
};
