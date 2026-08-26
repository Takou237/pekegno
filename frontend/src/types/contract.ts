export type ContractStatus = 'active' | 'due_soon' | 'expired' | 'suspended' | 'terminated';
export type BillingCycle = 'one_shot' | 'monthly' | 'quarterly' | 'yearly';

export interface Contract {
  id: string;
  number: string;
  client_id: string;
  company_id: string | null;
  agency_id: string;
  department_id: string | null;
  pack_id: string | null;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  amount: number;
  status: ContractStatus;
  auto_renew: boolean;
  renewal_count: number;
  parent_contract_id: string | null;
  notes: string | null;
  terminated_at: string | null;
  terminated_reason: string | null;
  created_at: string;
  client?: { id: string; first_name: string; last_name: string; name?: string };
  company?: { id: string; name: string };
  agency?: { id: string; name: string; code: string };
  services?: Array<{ id: string; name: string; code?: string; pivot: { price: number | null } }>;
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
  service_ids?: string[];
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: 'Actif',
  due_soon: 'À renouveler',
  expired: 'Expiré',
  suspended: 'Suspendu',
  terminated: 'Résilié',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  due_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
  terminated: 'bg-gray-200 text-gray-500 dark:bg-gray-600/10 dark:text-gray-500',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  one_shot: 'Ponctuel',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};
