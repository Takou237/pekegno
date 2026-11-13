export interface BilanServiceLine {
  category: string;
  label: string;
  count: number;
  total: number;
}

export interface BilanFormationMode {
  mode: string;
  count: number;
}

export interface BilanExpenseLine {
  name: string;
  total: number;
}

/** Caisse d'une agence sur la journée (cahier §2) : calculée depuis ses mouvements. */
export interface BilanTreasuryAccount {
  id: string;
  agency_id: string;
  code: string | null;
  name: string;
  type: string;
  opening: number;
  in: number;
  out: number;
  transfer_in: number;
  transfer_out: number;
  /** Solde théorique : opening + in − out + transfer_in − transfer_out. */
  closing: number;
  /** Clôture du jour, si elle a été faite. */
  closing_status: 'closed' | 'validated' | null;
  counted: number | null;
  difference: number | null;
}

export interface BilanAgency {
  date: string;
  agency_id: string | null;
  agency: { id: string; name: string } | null;
  services_by_category: BilanServiceLine[];
  products_by_category?: BilanServiceLine[];
  formation_count?: number;
  formation_total?: number;
  formation_by_mode?: BilanFormationMode[];
  /** Agency : encaissements packages / prestations (honoraires, hors pass-through). */
  agency_by_category?: Array<{ category: string; kind: 'package' | 'prestation'; count: number; total: number }>;
  agency_total?: number;
  /** Agency (D7/D15) : budget publicitaire client encaissé, exclu du CA. */
  agency_pass_through_total?: number;
  total_ventes: number;
  total_ventes_amount: number;
  cash_total: number;
  om_total: number;
  momo_total: number;
  mobile_total: number;
  bank_total: number;
  /** Une ligne par moyen de paiement (= par caisse). */
  by_method?: { key: string; label: string; total: number }[];
  total_received: number;
  expense_total: number;
  expenses_by_category: BilanExpenseLine[];
  /** Agence / groupe : total des caisses en début et fin de journée. Département : encaissé − dépenses cumulés. */
  solde_initial: number;
  solde_final: number;
  treasury_accounts?: BilanTreasuryAccount[];
  /** B14 : devise des montants (agence, ou groupe en vue multi-agences). */
  currency_code?: string;
}

export interface DailyBilan extends BilanAgency {
  agencies?: BilanAgency[];
  totals?: {
    total_ventes: number;
    total_ventes_amount: number;
    total_formations: number;
    total_encaisse: number;
    total_cash: number;
    total_om: number;
    total_momo: number;
    total_mobile: number;
    total_bank: number;
    total_depenses: number;
    total_solde_initial: number;
    total_solde_final: number;
  };
}

export interface BilanPeriod {
  from: string;
  to: string;
  agency_id: string | null;
  agency: { id: string; name: string } | null;
  sale_categories?: string[];
  days: BilanAgency[];
  currency_code?: string;
  /** B5 : flux additionnés ; soldes = premier solde initial et dernier solde final. */
  totals?: { total_ventes_amount: number; total_received: number; expense_total: number; solde_initial: number; solde_final: number };
}

export type BilanParams = {
  date?: string;
  agency_id?: string;
  /** Bilan limité à un département (ses factures et ses dépenses uniquement). */
  department_id?: string;
  country_id?: string;
};

export type BilanPeriodParams = {
  from?: string;
  to?: string;
  agency_id?: string;
  department_id?: string;
  country_id?: string;
};
