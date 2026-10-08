/**
 * Types du département Agency (packages, prestations, actions, équipe client,
 * notes, rapports). Voir doc/AGENCY_A_FAIRE.md (décisions D1 → D18).
 */

export type AgencyCategoryKind = 'package' | 'prestation';
export type BillingPeriod = 'monthly' | 'quarterly' | 'yearly' | 'one_shot';
export type Frequency = 'per_day' | 'per_week' | 'per_month' | 'once';
export type ActionType = 'community_management' | 'advertising' | 'content_production' | 'coaching' | 'strategy' | 'other';
export type ActionStatus = 'todo' | 'in_progress' | 'done' | 'validated' | 'blocked' | 'cancelled';
export type PrestationStatus =
  | 'draft'
  | 'pending_validation'
  | 'validated'
  | 'in_progress'
  | 'completed'
  | 'suspended'
  | 'cancelled'
  | 'rejected';

export interface AgencyCategory {
  id: string;
  department_id: string | null;
  kind: AgencyCategoryKind;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  packages_count?: number;
  prestations_count?: number;
}

export interface PackageItem {
  id?: string;
  service_id?: string | null;
  label: string;
  quantity?: number | null;
  frequency?: Frequency | null;
  unit?: string | null;
  action_type?: ActionType | null;
}

export interface PackageRecommendation {
  id?: string;
  client_team_role_id?: string | null;
  label: string;
  quantity?: number | null;
}

export interface Promotion {
  id: string;
  type: 'amount' | 'percent';
  promo_price: string | null;
  discount_percent: string | null;
  start_date: string;
  end_date: string;
}

export interface AgencyPackage {
  id: string;
  code: string | null;
  agency_id: string;
  agency?: { id: string; name: string } | null;
  department_id: string | null;
  category_id: string | null;
  category?: AgencyCategory | null;
  agency?: { id: string; name: string } | null;
  name: string;
  tagline: string | null;
  description: string | null;
  prerequisites: string | null;
  price_per_month: string;
  original_price: string | null;
  price_is_starting_from: boolean;
  effective_price: number;
  billing_period: BillingPeriod;
  min_duration_months: number | null;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
  items: PackageItem[];
  recommendations: PackageRecommendation[];
  promotions: Promotion[];
  contracts_count?: number;
}

export interface PackagePayload {
  /** Omettre si `target_country_ids` est fourni : le package est alors déployé dans tous les pays cochés. */
  agency_id?: string;
  /** Duplication : une copie du package est créée dans toutes les agences de ces pays. */
  target_country_ids?: string[];
  department_id?: string;
  category_id?: string | null;
  name: string;
  tagline?: string | null;
  description?: string | null;
  prerequisites?: string | null;
  price_per_month: number;
  original_price?: number | null;
  price_is_starting_from?: boolean;
  billing_period?: BillingPeriod;
  min_duration_months?: number | null;
  is_active?: boolean;
  items?: PackageItem[];
  recommendations?: PackageRecommendation[];
}

export interface SubscribePayload {
  client_id: string;
  commercial_id?: string;
  department_id?: string;
  start_date?: string;
  periods: number;
  auto_renew?: boolean;
  advance?: number;
  payment_type?: 'cash' | 'om' | 'momo' | 'mobile';
  /** Preuve de paiement (photo) : envoyée en multipart, examinée par le caissier. */
  proof_file?: File;
}

export interface PersonRef {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
}

export interface PrestationAction {
  id: string;
  prestation_id: string;
  type: ActionType;
  title: string;
  description: string | null;
  platform: string | null;
  quantity: number;
  frequency: Frequency;
  unit: string | null;
  budget: string;
  actual_cost: string | null;
  is_pass_through: boolean;
  assigned_to: string | null;
  assignee?: PersonRef | null;
  start_date: string | null;
  due_date: string | null;
  status: ActionStatus;
  comment: string | null;
  rating: number | null;
  quantity_done: number;
  is_overdue: boolean;
  progress?: { done: number; expected: number; percent: number };
  prestation?: { id: string; reference: string; name: string; status: PrestationStatus; client?: PersonRef | null };
}

export interface ActionPayload {
  type?: ActionType;
  title?: string;
  description?: string | null;
  platform?: string | null;
  quantity?: number;
  frequency?: Frequency;
  unit?: string | null;
  budget?: number;
  actual_cost?: number | null;
  is_pass_through?: boolean;
  assigned_to?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  status?: ActionStatus;
  comment?: string | null;
}

export interface ActionComment {
  id: string;
  body: string;
  created_at: string;
  author?: PersonRef | null;
}

export interface ActionLog {
  id: string;
  done_at: string;
  quantity_done: number;
  proof_url: string | null;
  cost: string | null;
  note: string | null;
  author?: PersonRef | null;
}

export type ExecutionStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface PrestationActionExecution {
  id: string;
  prestation_action_id: string;
  week_number: number;
  week_start_date: string | null;
  week_end_date: string | null;
  occurrence_number: number;
  title: string | null;
  status: ExecutionStatus;
  scheduled_date: string | null;
  done_at: string | null;
  proof_url: string | null;
  actual_cost: number | null;
  note: string | null;
  is_manual: boolean;
  is_overdue?: boolean;
  user_id: string | null;
  user?: PersonRef | null;
  assigned_to: string | null;
  assignee?: PersonRef | null;
  created_at: string;
  updated_at: string;
}

export interface WeekSummary {
  week_number: number;
  week_start_date: string | null;
  week_end_date: string | null;
  total: number;
  done: number;
  overdue: number;
  is_current: boolean;
  percent: number;
}

export interface ClientTeamRole {
  id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  members_count?: number;
}

export interface TeamMember {
  id: string;
  prestation_id: string;
  user_id: string;
  client_team_role_id: string | null;
  is_lead: boolean;
  start_date: string | null;
  end_date: string | null;
  user?: PersonRef;
  team_role?: ClientTeamRole | null;
}

export interface RatingSummary {
  avg: number | null;
  count: number;
  distribution: Record<string, number>;
  has_direct_rating?: boolean;
  direct_rating?: number | null;
}

/** Offre de prestation (ex. « Campagne Facebook ») : fiche à laquelle les clients souscrivent. */
export interface PrestationOffer {
  id: string;
  agency_id: string;
  agency?: { id: string; name: string } | null;
  department_id: string | null;
  department?: { id: string; name: string } | null;
  category_id: string | null;
  category?: { id: string; name: string; color?: string | null } | null;
  name: string;
  description: string | null;
  is_active: boolean;
  subscriptions_count?: number;
  subscriptions_rating_avg?: number | null;
  created_at: string;
}

export interface PrestationOfferPayload {
  agency_id?: string;
  department_id?: string | null;
  category_id?: string | null;
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface Prestation {
  id: string;
  reference: string;
  agency_id: string;
  agency?: { id: string; name: string } | null;
  department_id: string | null;
  category_id: string | null;
  category?: { id: string; name: string; color?: string | null } | null;
  offer_id: string | null;
  offer?: { id: string; name: string; department_id?: string | null } | null;
  name: string;
  description: string | null;
  client_id: string;
  client?: PersonRef & { phone?: string | null };
  commercial_id: string | null;
  commercial?: PersonRef | null;
  package_id: string | null;
  package?: { id: string; name: string } | null;
  contract_id: string | null;
  contract?: {
    id: string;
    number: string;
    status: string;
    invoices?: Array<{ id: string; number: string; total_amount: string; amount_paid: string; status: string; balance_due?: number }>;
  } | null;
  start_date: string;
  end_date: string;
  budget: string;
  budget_allocated: number;
  budget_remaining: number;
  budget_spent: number;
  pass_through_budget: number;
  commission_type: 'percent' | 'fixed' | null;
  commission_value: string | null;
  status: PrestationStatus;
  status_reason: string | null;
  rating_avg: string | null;
  rating_count: number;
  client_direct_rating?: number | null;
  client_direct_comment?: string | null;
  client_direct_rated_at?: string | null;
  display_rating_avg?: number | null;
  display_rating_count?: number;
  validated_at: string | null;
  validator?: PersonRef | null;
  declared_advance_amount?: number | string | null;
  declared_total_paid?: boolean;
  payment_proof_id?: string | null;
  submitted_with_proof_at?: string | null;
  actions?: PrestationAction[];
  team_members?: TeamMember[];
  rating_summary?: RatingSummary;
  allowed_transitions?: PrestationStatus[];
  created_at: string;
}

export interface PrestationPayload {
  agency_id?: string;
  offer_id?: string;
  department_id?: string;
  category_id?: string | null;
  name?: string;
  description?: string | null;
  client_id?: string;
  commercial_id?: string | null;
  start_date?: string;
  end_date?: string;
  budget?: number;
  commission_type?: 'percent' | 'fixed' | null;
  commission_value?: number | null;
}

export interface TrackingRow {
  id: string;
  reference: string;
  name: string;
  client: string | null;
  category: string | null;
  commercial: string | null;
  start_date: string;
  end_date: string;
  rating_avg: number | null;
  rating_count: number;
  display_rating_avg: number | null;
  display_rating_count: number;
  has_direct_rating: boolean;
  status: PrestationStatus;
  status_reason: string | null;
  allowed_transitions: PrestationStatus[];
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  updated_at: string;
  action?: { id: string; title: string; type: ActionType };
  client?: PersonRef;
}

export interface TeamOverviewRow {
  user: PersonRef;
  roles: ClientTeamRole[];
  prestations: Array<{ id: string; reference: string; name: string; status: PrestationStatus; client: string | null; role: string | null; is_lead: boolean }>;
  prestations_count: number;
  open_actions: number;
}

export interface AgencyReport {
  period: { from: string; to: string };
  kpis: {
    revenue: number;
    collected: number;
    pass_through_collected: number;
    receivables: number;
    mrr: number;
    active_contracts: number;
    contracts_to_renew: number;
    prestations_in_progress: number;
    overdue_actions: number;
    renewal_rate: number | null;
    ended_contracts: number;
    renewed_contracts: number;
  };
  contracts_by_status: Record<string, number>;
  prestations_by_status: Record<string, number>;
  budget: { total: number; allocated: number; spent: number };
  rating: RatingSummary;
  top_commercials: Array<{ id: string; name: string; contracts: number; amount: number }>;
  top_packages: Array<{ id: string; name: string; contracts: number; amount: number }>;
  revenue_by_category: Array<{ category: string; total: number }>;
}

export interface AgencyNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface LaravelPage<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const PRESTATION_STATUS_COLORS: Record<PrestationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_validation: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  validated: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  in_progress: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300',
  suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  cancelled: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
};

export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  todo: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300',
  validated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  cancelled: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

/** Statuts qui exigent un motif (rejet, suspension, annulation). */
export const STATUSES_REQUIRING_REASON: PrestationStatus[] = ['suspended', 'cancelled', 'rejected'];

export const ACTION_TYPES: ActionType[] = ['community_management', 'advertising', 'content_production', 'coaching', 'strategy', 'other'];
export const ACTION_STATUSES: ActionStatus[] = ['todo', 'in_progress', 'done', 'validated', 'blocked', 'cancelled'];
export const FREQUENCIES: Frequency[] = ['per_day', 'per_week', 'per_month'];
export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'yearly'];
export const PRESTATION_STATUSES: PrestationStatus[] = [
  'draft', 'pending_validation', 'validated', 'in_progress', 'completed', 'suspended', 'cancelled', 'rejected',
];

export function personName(p?: PersonRef | null): string {
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '—';
}
