import type { Commercial } from './commercial';
import type { Agency } from './agency';
import type { Prospect } from './prospect';

export type OpportunityStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Opportunity {
  id: string;
  title: string;
  prospect_id: string | null;
  client_id: string | null;
  company_id: string | null;
  agency_id: string;
  department_id: string | null;
  commercial_id: string;
  stage: OpportunityStage;
  expected_amount: number | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  loss_reason: string | null;
  created_at: string;
  updated_at: string;
  prospect?: Prospect;
  company?: { id: string; name: string };
  commercial?: Commercial;
  agency?: Agency;
  client?: unknown;
}

export interface OpportunityPayload {
  title: string;
  prospect_id?: string;
  client_id?: string;
  company_id?: string;
  agency_id: string;
  department_id?: string;
  commercial_id: string;
  expected_amount?: number;
  expected_close_date?: string;
}

export interface OpportunityListParams {
  stage?: OpportunityStage;
  commercial_id?: string;
  agency_id?: string;
  search?: string;
  per_page?: number;
}

export interface OpportunityListResponse {
  data: Opportunity[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}

export interface PipelineEntry {
  stage: OpportunityStage;
  count: number;
  total_amount: number;
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  proposal: 'Proposition',
  negotiation: 'Négociation',
  won: 'Gagné',
  lost: 'Perdu',
};

export const STAGE_COLORS: Record<OpportunityStage, string> = {
  new: 'bg-slate-100 text-slate-700 border-slate-300',
  contacted: 'bg-blue-100 text-blue-700 border-blue-300',
  qualified: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  proposal: 'bg-amber-100 text-amber-700 border-amber-300',
  negotiation: 'bg-orange-100 text-orange-700 border-orange-300',
  won: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  lost: 'bg-red-100 text-red-700 border-red-300',
};

export const OPEN_STAGES: OpportunityStage[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
