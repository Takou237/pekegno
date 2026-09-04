import type { Agency } from './agency';
import type { CommissionPayment } from './commercial';

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'om' | 'momo' | 'mobile';

export interface AgencySnapshot {
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string | null;
  label: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  pass_tier: string | null;
  pass_label: string | null;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: string;
  payment_method: PaymentMethod;
  is_advance: boolean;
  paid_at: string;
  received_by: string | null;
  comment: string | null;
  treasury_account_id: string | null;
  receiver?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
  treasury_account?: { id: string; name: string; type: string } | null;
}

export interface Invoice {
  id: string;
  number: string;
  agency_id: string | null;
  client_id: string | null;
  client_name: string | null;
  client_label: string | null;
  commercial_id: string | null;
  seller_user_id: string | null;
  invoice_date: string;
  payment_type: PaymentMethod | null;
  total_amount: string;
  amount_paid: string;
  discount: string;
  vat_rate: string;
  vat_amount: number;
  status: InvoiceStatus;
  commission_amount: string | null;
  points_awarded: number | null;
  comment: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  balance_due: number;
  is_cancelled: boolean;
  agency_snapshot: AgencySnapshot | null;
  agency?: Pick<Agency, 'id' | 'name' | 'code'> | null;
  client?: { id: string; first_name: string | null; last_name: string | null; email: string; client_number: string | null; phone: string | null } | null;
  commercial?: { id: string; first_name: string; last_name: string; email?: string | null } | null;
  seller?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  commission_payments?: CommissionPayment[];
}

export interface InvoiceTotals {
  revenue: number;
  outstanding: number;
  advances: number;
}

export interface InvoiceListParams {
  search?: string;
  status?: InvoiceStatus | `${InvoiceStatus},${InvoiceStatus}`;
  agency_id?: string;
  client_id?: string;
  commercial_id?: string;
  from?: string;
  to?: string;
  include_cancelled?: boolean;
  from_enrollments?: boolean;
  course_id?: string;
  session_id?: string;
  per_page?: number;
  page?: number;
}

export interface InvoiceLinePayload {
  service_id?: string;
  label?: string;
  unit_price: number;
  quantity: number;
  pass_tier?: string;
}

export interface CreateInvoicePayload {
  agency_id?: string;
  client_id?: string;
  client_name?: string;
  commercial_id?: string;
  seller_user_id?: string;
  invoice_date?: string;
  payment_type?: PaymentMethod;
  comment?: string;
  advance?: number;
  discount?: number;
  vat_rate?: number;
  items: InvoiceLinePayload[];
}

export interface UpdateInvoicePayload {
  client_id?: string;
  client_name?: string;
  commercial_id?: string;
  payment_type?: PaymentMethod;
  comment?: string;
}

export interface PayInvoicePayload {
  amount: number;
  payment_method: PaymentMethod;
  is_advance?: boolean;
  paid_at?: string;
  comment?: string;
  treasury_account_id?: string;
}
