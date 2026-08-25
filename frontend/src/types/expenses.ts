export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' | 'closed';

export interface Expense {
  id: string;
  number: string;
  agency_id: string;
  department_id: string | null;
  category_id: string;
  amount: number;
  expense_date: string;
  status: ExpenseStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  paid_by: string | null;
  paid_at: string | null;
  treasury_account_id: string | null;
  justification_path: string | null;
  note: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  agency?: { id: string; name: string };
  department?: { id: string; name: string };
  category?: { id: string; name: string; type: string };
  requestor?: { id: string; username: string; first_name: string; last_name: string };
  approver?: { id: string; username: string; first_name: string; last_name: string };
  rejector?: { id: string; username: string; first_name: string; last_name: string };
  payer?: { id: string; username: string; first_name: string; last_name: string };
  treasuryAccount?: { id: string; name: string };
}

export interface ExpenseListParams {
  status?: ExpenseStatus;
  agency_id?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ExpenseListResponse {
  data: Expense[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ExpenseCreatePayload {
  agency_id: string;
  department_id?: string;
  category_id: string;
  amount: number;
  expense_date: string;
  note?: string;
  justification_path?: string;
}
