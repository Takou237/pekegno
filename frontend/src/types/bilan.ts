export interface BilanServiceLine {
  label: string;
  count: number;
  total: number;
}

export interface BilanCoherence {
  ok: boolean;
  message: string;
}

export interface DailyBilan {
  date: string;
  agency_id: string | null;
  agency: { id: string; name: string } | null;
  services: BilanServiceLine[];
  total_services_sold: number;
  cash_total: number;
  mobile_total: number;
  total_received: number;
  expense_total: number;
  solde_initial: number;
  solde_final: number;
  coherence: BilanCoherence;
}

export interface BilanParams {
  date?: string;
  agency_id?: string;
}
