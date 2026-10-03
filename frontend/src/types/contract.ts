export type ContractStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'due_soon'
  | 'expired'
  | 'suspended'
  | 'terminated'
  | 'renewed';
export type BillingCycle = 'one_shot' | 'monthly' | 'quarterly' | 'yearly';
export type ContractOrigin = 'manual' | 'prestation' | 'package';

export interface ContractInvoice {
  id: string;
  number: string;
  total_amount: string;
  amount_paid: string;
  balance_due?: number;
  status: string;
  payments?: Array<{ id: string; amount: string; paid_at: string; payment_method: string }>;
}

export interface Contract {
  id: string;
  number: string;
  client_id: string;
  company_id: string | null;
  agency_id: string;
  department_id: string | null;
  pack_id: string | null;
  origin: ContractOrigin;
  prestation_id: string | null;
  commercial_id: string | null;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  amount: string | number;
  budget_allocated: string | null;
  status: ContractStatus;
  auto_renew: boolean;
  renewal_count: number;
  parent_contract_id: string | null;
  notes: string | null;
  activated_at: string | null;
  signed_at: string | null;
  signed_document_path: string | null;
  suspended_reason: string | null;
  terminated_at: string | null;
  terminated_reason: string | null;
  created_at: string;
  client?: { id: string; first_name: string; last_name: string; email?: string; name?: string };
  company?: { id: string; name: string } | null;
  agency?: { id: string; name: string; code?: string };
  pack?: { id: string; name: string } | null;
  prestation?: { id: string; reference: string; name: string; status: string; budget?: string } | null;
  commercial?: { id: string; first_name: string; last_name: string } | null;
  parent_contract?: { id: string; number: string } | null;
  child_contracts?: Array<{ id: string; number: string; status: ContractStatus }>;
  invoices?: ContractInvoice[];
}

export interface ContractPayload {
  client_id: string;
  company_id?: string;
  agency_id: string;
  department_id?: string;
  pack_id?: string;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  amount: number;
  auto_renew?: boolean;
  notes?: string;
}

export interface ContractListParams {
  agency_id?: string;
  department_id?: string;
  status?: string;
  origin?: ContractOrigin;
  client_id?: string;
  pack_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'pending', 'active', 'due_soon', 'expired', 'suspended', 'terminated', 'renewed'];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente du 1er paiement',
  active: 'Actif',
  due_soon: 'À renouveler',
  expired: 'Expiré',
  suspended: 'Suspendu',
  terminated: 'Résilié',
  renewed: 'Renouvelé',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  due_soon: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
  terminated: 'bg-gray-200 text-gray-500 dark:bg-gray-600/10 dark:text-gray-500',
  renewed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  one_shot: 'Ponctuel',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};
