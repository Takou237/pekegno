import type { Agency } from './agency';
import type { Prospect } from './prospect';

export interface CommercialUserLink {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
}

export type CommercialPointReason = 'sale' | 'penalty' | 'adjustment' | 'prospect' | 'conversion';
export type CommercialKind = 'commercial' | 'employe';

export interface CommercialPoint {
  id: string;
  commercial_id: string;
  points: number;
  reason: CommercialPointReason;
  invoice_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CommissionPayment {
  id: string;
  commercial_id: string;
  invoice_id: string;
  payment_id: string | null;
  service_id: string | null;
  amount: string;
  base_amount: string;
  rule: string;
  rate: string | null;
  invoice_total: string;
  created_by: string | null;
  created_at: string;
  invoice?: { id: string; number: string } | null;
}

export interface Commercial {
  id: string;
  user_id: string | null;
  agency_id: string | null;
  kind: CommercialKind;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  commission_type: 'none' | 'percent' | 'fixed';
  commission_value: string | null;
  points_balance: number;
  is_active: boolean;
  full_name?: string;
  agency?: Agency | null;
  user?: CommercialUserLink | null;
  points?: CommercialPoint[];
  prospects?: Prospect[];
  commission_payments?: CommissionPayment[];
  created_at: string;
  updated_at: string;
}

export interface CommercialPayload {
  user_id?: string | null;
  agency_id?: string | null;
  kind?: CommercialKind;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  commission_type?: 'none' | 'percent' | 'fixed';
  commission_value?: string | number | null;
  is_active?: boolean;
}

export interface CommercialListParams {
  search?: string;
  kind?: CommercialKind;
  agency_id?: string;
  is_active?: boolean;
  linked?: 'true' | 'false';
  per_page?: number;
  page?: number;
}

export interface CommercialStats {
  commercial: Pick<
    Commercial,
    'id' | 'first_name' | 'last_name' | 'email' | 'points_balance' | 'commission_type' | 'commission_value' | 'is_active'
  >;
  turnover: number;
  sales_count: number;
  commissions: number;
  points_balance: number;
  monthly: { month: string; total: string | number; count: number }[];
  services_sold: { label: string; quantity: number; total: number }[];
}

export interface RankingEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  agency_id: string | null;
  points_balance: number;
  is_active: boolean;
  sales_count: number;
  turnover: string | number;
  commission_total: string | number;
}

export interface AvailableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean;
}
