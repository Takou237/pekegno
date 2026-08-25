import type { DepartmentType } from './department';

export type TreasuryAccountType = 'cash' | 'mobile_money' | 'bank';

export interface TreasuryAccount {
  id: string;
  agency_id: string | null;
  name: string;
  type: TreasuryAccountType;
  provider: string | null;
  account_number: string | null;
  opening_balance: number;
  currency_code: string;
  is_active: boolean;
  balance: number;
  created_at: string;
  updated_at: string;
}

export type TreasuryDirection = 'in' | 'out';

export interface TreasuryTransaction {
  id: string;
  treasury_account_id: string;
  direction: TreasuryDirection;
  amount: number;
  source_type: string | null;
  source_id: string | null;
  category: string | null;
  label: string;
  reference: string | null;
  transacted_at: string;
  created_by: string | null;
  account?: TreasuryAccount;
  creator?: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface TreasuryTransactionsResponse {
  data: TreasuryTransaction[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface TreasuryAccountListParams {
  agency_id?: string;
  type?: TreasuryAccountType;
}

export interface TreasuryTransactionListParams {
  treasury_account_id?: string;
  direction?: TreasuryDirection;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface TransferPayload {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  label?: string;
}
