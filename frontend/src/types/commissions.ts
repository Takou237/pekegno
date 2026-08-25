export type CommissionEntryStatus = 'calculated' | 'validated' | 'paid' | 'cancelled';

export interface CommissionRule {
  id: string;
  rule_group_id: string;
  version: number;
  name: string;
  beneficiary_commercial_id: string | null;
  scope_country_id: string | null;
  scope_agency_id: string | null;
  scope_department_id: string | null;
  service_id: string | null;
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
  service?: { id: string; name: string } | null;
  scopeAgency?: { id: string; name: string } | null;
  scopeCountry?: { id: string; name: string } | null;
  scopeDepartment?: { id: string; name: string } | null;
}

export interface CommissionEntry {
  id: string;
  invoice_id: string;
  invoice_payment_id: string | null;
  commission_rule_id: string;
  rule_snapshot: Record<string, unknown>;
  beneficiary_commercial_id: string;
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
  beneficiary?: { id: string; first_name: string; last_name: string };
  rule?: CommissionRule;
  validator?: { id: string; username: string; first_name: string; last_name: string };
  payer?: { id: string; username: string; first_name: string; last_name: string };
}

export interface CommissionRulePayload {
  name: string;
  beneficiary_commercial_id?: string;
  scope_country_id?: string;
  scope_agency_id?: string;
  scope_department_id?: string;
  service_id?: string;
  trigger_event: string;
  formula_type: string;
  percent_value?: number;
  fixed_amount?: number;
  tiers_json?: unknown[];
  starts_on?: string;
  ends_on?: string;
}

export interface CommissionEntryListParams {
  status?: CommissionEntryStatus;
  beneficiary_commercial_id?: string;
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
