export interface BilanServiceLine {
  category: string;
  label: string;
  count: number;
  total: number;
}

export interface BilanExpenseLine {
  name: string;
  total: number;
}

export interface BilanAgency {
  date: string;
  agency_id: string | null;
  agency: { id: string; name: string } | null;
  services_by_category: BilanServiceLine[];
  total_ventes: number;
  cash_total: number;
  om_total: number;
  momo_total: number;
  total_received: number;
  expense_total: number;
  expenses_by_category: BilanExpenseLine[];
  solde_initial: number;
  solde_final: number;
}

export interface DailyBilan extends BilanAgency {
  agencies?: BilanAgency[];
  totals?: {
    total_ventes: number;
    total_encaisse: number;
    total_cash: number;
    total_om: number;
    total_momo: number;
    total_depenses: number;
    total_solde_final: number;
  };
}

export interface BilanPeriod {
  from: string;
  to: string;
  agency_id: string | null;
  agency: { id: string; name: string } | null;
  days: BilanAgency[];
}

export type BilanParams = {
  date?: string;
  agency_id?: string;
};

export type BilanPeriodParams = {
  from?: string;
  to?: string;
  agency_id?: string;
};
