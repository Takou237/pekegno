import type { PaginatedResponse } from '@/types/agency';

export type OrderStatus = 'draft' | 'confirmed' | 'pending_validation' | 'completed' | 'cancelled';

export interface OrderLine {
  id: string;
  order_id: string;
  line_type: 'catalog' | 'manual';
  service_id: string | null;
  label: string;
  description: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface Order {
  id: string;
  number: string;
  agency_id: string;
  client_id: string;
  commercial_id: string | null;
  invoice_id: string | null;
  status: OrderStatus;
  order_date: string;
  subtotal: string;
  discount: string;
  vat_rate: string;
  total_amount: string;
  notes: string | null;
  proof_path: string | null;
  proof_url: string | null;
  submitted_at: string | null;
  validated_by: string | null;
  validation_note: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    client_number?: string | null;
    phone?: string | null;
  } | null;
  agency?: { id: string; name: string; code: string } | null;
  commercial?: {
    id: string;
    user?: { id: string; first_name: string | null; last_name: string | null } | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  validatedBy?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  lines?: OrderLine[];
}

export interface OrderListParams {
  search?: string;
  status?: OrderStatus;
  client_id?: string;
  agency_id?: string;
  commercial_id?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface OrderLinePayload {
  line_type?: 'catalog' | 'manual';
  service_id?: string;
  label?: string;
  unit_price?: number;
  quantity?: number;
}

export interface CreateOrderPayload {
  client_id: string;
  agency_id?: string;
  commercial_id?: string;
  order_date?: string;
  status?: OrderStatus;
  discount?: number;
  vat_rate?: number;
  notes?: string;
  lines: OrderLinePayload[];
}

export interface SubmitOrderPayload {
  proof_path?: string;
  proof_url?: string;
}

export interface ValidateOrderPayload {
  payment_method?: string;
  treasury_account_id?: string;
  paid_at?: string;
  note?: string;
}

export interface DeclineOrderPayload {
  note?: string;
}

export interface OrderListResponse {
  data: Order[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export type { PaginatedResponse };
