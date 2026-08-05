export type CommissionType = 'none' | 'percent' | 'fixed';

export interface Setting {
  key: string;
  value: string | number | boolean;
  description: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface SettingsPayload {
  sales_points_per_sale?: number;
  inactivity_period_days?: number;
  inactivity_penalty_points?: number;
  default_commission_type?: CommissionType;
  default_commission_value?: number;
  invoice_prefix?: string;
}
