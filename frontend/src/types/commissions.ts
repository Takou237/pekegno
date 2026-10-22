export type CommissionEntryStatus = 'calculated' | 'validated' | 'paid' | 'cancelled';

export type CommissionPaymentMethod = 'especes' | 'orange_money' | 'mobile_money';

export const COMMISSION_PAYMENT_METHODS: CommissionPaymentMethod[] = [
  'especes',
  'orange_money',
  'mobile_money',
];

/** Assiette d'une règle : ce qui déclenche la commission. */
export type CommissionBasis = 'sale' | 'renewal' | 'upgrade' | 'monthly_revenue' | 'growth' | 'manual';

export const COMMISSION_BASES: CommissionBasis[] = ['sale', 'renewal', 'upgrade', 'monthly_revenue', 'growth', 'manual'];

/** Palier « à partir de » (CA mensuel ou ratio de croissance). */
export interface CommissionTier {
  min: number;
  percent: number;
  fixed_bonus?: number;
  pot_bonus?: number;
  bonus_requires_recovery?: boolean;
}

export interface CommissionRule {
  id: string;
  rule_group_id: string;
  version: number;
  name: string;
  basis?: CommissionBasis;
  target_kind?: 'product' | 'service' | 'course' | 'package' | null;
  description?: string | null;
  product_id?: string | null;
  category_id?: string | null;
  renewal_number?: number | null;
  renewal_on_time?: boolean;
  revenue_scope?: 'own' | 'agency';
  min_recovery_rate?: number | string | null;
  recovery_period?: 'previous_month' | 'same_month_last_year';
  growth_multiplier?: number | string | null;
  max_percent?: number | string | null;
  bonus_min?: number | string | null;
  bonus_max?: number | string | null;
  roles?: { id: string; name: string }[];
  product?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  beneficiary_commercial_id: string | null;
  beneficiary_seller_profile_id: string | null;
  scope_country_id: string | null;
  scope_agency_id: string | null;
  scope_department_id: string | null;
  service_id: string | null;
  course_id: string | null;
  package_id?: string | null;
  package?: { id: string; name: string } | null;
  trigger_event: 'on_sale' | 'on_payment' | 'on_full_payment';
  formula_type: 'percent' | 'fixed' | 'tiered';
  percent_value: number | null;
  fixed_amount: number | null;
  tiers_json: unknown[] | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  beneficiary?: { id: string; first_name: string; last_name: string } | null;
  sellerProfile?: {
    id: string;
    kind: string;
    user?: { id: string; first_name: string; last_name: string; email: string } | null;
  } | null;
  course?: { id: string; name: string; code: string } | null;
  service?: { id: string; name: string } | null;
  scopeAgency?: { id: string; name: string } | null;
  scopeCountry?: { id: string; name: string } | null;
  scopeDepartment?: { id: string; name: string } | null;
}

export interface CommissionRulePayload {
  name: string;
  basis?: CommissionBasis;
  target_kind?: 'product' | 'service' | 'course' | 'package';
  description?: string;
  product_id?: string;
  category_id?: string;
  renewal_number?: number;
  renewal_on_time?: boolean;
  revenue_scope?: 'own' | 'agency';
  min_recovery_rate?: number;
  recovery_period?: 'previous_month' | 'same_month_last_year';
  growth_multiplier?: number;
  max_percent?: number;
  bonus_min?: number;
  bonus_max?: number;
  role_ids?: string[];
  beneficiary_commercial_id?: string;
  beneficiary_seller_profile_id?: string;
  scope_country_id?: string;
  scope_agency_id?: string;
  scope_department_id?: string;
  service_id?: string;
  course_id?: string;
  package_id?: string;
  trigger_event: string;
  formula_type: string;
  percent_value?: number;
  fixed_amount?: number;
  tiers_json?: CommissionTier[];
  starts_on?: string;
  ends_on?: string;
}

export interface CommissionBeneficiary {
  id: string;
  type: 'seller_profile' | 'commercial' | 'team_member' | 'user';
  name: string;
  kind: string | null;
  commission_type: string | null;
  commission_value: number | string | null;
  total_owed: number;
  total_paid: number;
  balance: number;
}

export interface CommissionBeneficiarySummary {
  data: CommissionBeneficiary[];
  totals: { total_owed: number; total_paid: number };
}

export interface CommissionPaymentPayload {
  beneficiary_type: 'seller_profile' | 'commercial' | 'team_member' | 'user';
  beneficiary_id: string;
  amount: number;
  treasury_account_id?: string;
  payment_method?: CommissionPaymentMethod;
  note?: string;
}

export interface CommissionEntry {
  id: string;
  invoice_id: string | null;
  invoice_payment_id: string | null;
  commission_rule_id: string | null;
  rule_snapshot: Record<string, unknown>;
  beneficiary_commercial_id: string | null;
  seller_profile_id: string | null;
  category: 'training' | 'service' | 'agency' | 'bonus' | null;
  beneficiary_user_id?: string | null;
  period?: string | null;
  beneficiaryUser?: { id: string; first_name: string; last_name: string } | null;
  product_id: string | null;
  product_type: 'course' | 'service' | 'package' | 'prestation' | null;
  base_amount: number;
  amount: number;
  status: CommissionEntryStatus;
  validated_by: string | null;
  validated_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  invoice?: { id: string; number: string; total_amount: number };
  beneficiary?: { id: string; first_name: string; last_name: string } | null;
  teamMember?: { id: string; first_name: string; last_name: string } | null;
  sellerProfile?: {
    id: string;
    kind: string;
    user?: { id: string; first_name: string; last_name: string; email: string } | null;
  } | null;
  rule?: CommissionRule;
  validator?: { id: string; username: string; first_name: string; last_name: string };
  payer?: { id: string; username: string; first_name: string; last_name: string };
}

export interface CommissionPayment {
  id: string;
  commercial_id: string | null;
  seller_profile_id: string | null;
  commission_entry_id: string | null;
  treasury_account_id: string | null;
  payment_method?: CommissionPaymentMethod | null;
  amount: number;
  base_amount: number | null;
  rule: string | null;
  invoice_total: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  commercial?: { id: string; first_name: string; last_name: string } | null;
  sellerProfile?: {
    id: string;
    kind: string;
    user?: { id: string; first_name: string; last_name: string; email: string } | null;
  } | null;
  treasuryAccount?: { id: string; name: string } | null;
  commissionEntry?: CommissionEntry | null;
}

export interface CommissionEntryListParams {
  status?: CommissionEntryStatus;
  category?: 'training' | 'service' | 'agency';
  agency_id?: string;
  beneficiary_commercial_id?: string;
  seller_profile_id?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface CommissionEntryListResponse {
  data: CommissionEntry[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
