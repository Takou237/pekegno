export type TreasuryAccountType = 'cash' | 'mobile_money' | 'bank';

export interface TreasuryAccount {
  id: string;
  agency_id: string | null;
  agency?: { id: string; name: string } | null;
  name: string;
  code: string | null;
  visible_roles: string[] | null;
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
  transfer_type?: TransferType | null;
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
  /** transfer = transferts seulement ; movement = tout sauf transferts. */
  kind?: 'transfer' | 'movement';
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export type TransferType = 'bank_deposit' | 'admin_disbursement' | 'withdrawal' | 'internal';

export interface TransferPayload {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  label?: string;
  transfer_type?: TransferType;
}

/** Journée d'une caisse (cahier §2). */
export interface CashDayBreakdown {
  opening: number;
  in: number;
  out: number;
  transfer_in: number;
  transfer_out: number;
  /** Solde théorique = opening + in − out + transfer_in − transfer_out. */
  closing: number;
}

/** Journée de travail d'une caisse : de la réouverture à la clôture. */
export interface CashJourney extends CashDayBreakdown {
  treasury_account_id: string;
  /** Caisse fermée par la caissière : rien n'y entre ni n'en sort. */
  is_closed: boolean;
  /** Début de la journée (dernière clôture), null si jamais clôturée. */
  since: string | null;
  closed_at: string | null;
  open_closing_id: string | null;
}

export type CashClosingStatus = 'closed' | 'validated';

export interface CashClosing {
  id: string;
  agency_id: string | null;
  treasury_account_id: string;
  closing_date: string;
  opening_balance: number;
  theoretical_balance: number;
  actual_balance: number;
  difference: number;
  justification: string | null;
  status: CashClosingStatus;
  closed_by: string | null;
  validated_by: string | null;
  validated_at: string | null;
  account?: TreasuryAccount;
  breakdown?: CashDayBreakdown | null;
  closer?: { id: string; name?: string; first_name?: string | null; last_name?: string | null };
  closed_at?: string | null;
  validator?: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface CashClosingListParams {
  date?: string;
  agency_id?: string;
  treasury_account_id?: string;
}

export interface CloseCashPayload {
  treasury_account_id: string;
  actual_balance: number;
  justification?: string;
}
