export type AccountingType = 'income' | 'expense';

export interface AccountingCategory {
  id: string;
  name: string;
  type: AccountingType;
  agency_id: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountingTransaction {
  id: string;
  number: number;
  agency_id: string | null;
  category_id: string | null;
  type: AccountingType;
  label: string;
  reference: string | null;
  amount: string;
  client_id: string | null;
  invoice_id: string | null;
  transacted_at: string;
  operator_id: string | null;
  note: string | null;
  beneficiary: string | null;
  justification: string | null;
  created_at: string;
  updated_at: string;
  category?: AccountingCategory | null;
  agency?: { id: string; name: string } | null;
  operator?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface AccountingListParams {
  search?: string;
  type?: AccountingType;
  agency_id?: string;
  category_id?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface AccountingTransactionPayload {
  agency_id?: string | null;
  category_id?: string | null;
  type: AccountingType;
  label: string;
  reference?: string | null;
  amount: number;
  client_id?: string | null;
  invoice_id?: string | null;
  transacted_at: string;
  note?: string | null;
  beneficiary?: string | null;
  justification?: string | null;
}

export interface AccountingCategoryPayload {
  name: string;
  type: AccountingType;
  agency_id?: string | null;
}

export interface AccountingTotals {
  income: number;
  expense: number;
  balance: number;
}
