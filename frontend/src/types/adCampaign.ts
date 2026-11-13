/** T3.8-T3.11 — Publicité Pekegno : campagne locale ou nationale. */

export type AdCampaignBranch = 'academy' | 'agency' | 'store' | 'studio';

export type AdCampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface AdCampaign {
  id: string;
  name: string;
  branch: AdCampaignBranch;
  country_id: string;
  is_national: boolean;
  /** Nul pour une campagne nationale (répartie au prorata du CA). */
  agency_id: string | null;
  budget: number;
  start_date: string;
  end_date: string;
  status: AdCampaignStatus;
  description: string | null;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
  country?: { id: string; name: string; currency_code?: string } | null;
  agency?: { id: string; name: string; code?: string; country_id?: string } | null;
}

export interface AdCampaignPayload {
  name: string;
  branch: AdCampaignBranch;
  is_national: boolean;
  country_id?: string | null;
  agency_id?: string | null;
  budget: number;
  start_date: string;
  end_date: string;
  status: AdCampaignStatus;
  description?: string | null;
}

export interface AdCampaignListParams {
  country_id?: string;
  agency_id?: string;
  branch?: AdCampaignBranch;
  status?: AdCampaignStatus;
  is_national?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface AdCampaignListResponse {
  data: AdCampaign[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
