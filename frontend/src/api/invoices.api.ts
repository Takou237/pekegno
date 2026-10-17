import { client } from './client';
import type {
  CreateInvoicePayload,
  Invoice,
  InvoiceListParams,
  InvoiceTotals,
  PayInvoicePayload,
  PayRemainingPayload,
  PaymentProof,
  PaymentProofStatus,
  RejectInvoicePayload,
  UpdateInvoicePayload,
} from '@/types/invoice';
import type { PaginatedResponse } from '@/types/agency';
import type { ProofReviewResponse } from '@/types/invoice';

export interface InvoiceIndexResponse {
  invoices: PaginatedResponse<Invoice>;
  totals: InvoiceTotals;
}

export interface ProofListParams {
  status?: PaymentProofStatus;
  invoice_id?: string;
  agency_id?: string;
  country_id?: string;
  page?: number;
  per_page?: number;
}

export const invoicesApi = {
  async list(params: InvoiceListParams = {}): Promise<InvoiceIndexResponse> {
    const { data } = await client.get<InvoiceIndexResponse>('/invoices', { params });
    return data;
  },

  async create(payload: CreateInvoicePayload): Promise<Invoice> {
    const { data } = await client.post<Invoice>('/invoices', payload);
    return data;
  },

  async createWithProof(payload: CreateInvoicePayload, proofFile: File): Promise<Invoice> {
    const formData = new FormData();
    formData.append('proof_file', proofFile);
    const append = (key: string, value: unknown) => {
      if (value === undefined || value === null) return;
      formData.append(key, String(value));
    };
    append('agency_id', payload.agency_id);
    append('client_id', payload.client_id);
    append('client_name', payload.client_name);
    append('commercial_id', payload.commercial_id);
    append('seller_user_id', payload.seller_user_id);
    append('invoice_date', payload.invoice_date);
    append('payment_type', payload.payment_type);
    append('payer_phone', payload.payer_phone);
    append('comment', payload.comment);
    append('advance', payload.advance);
    append('discount', payload.discount);
    append('vat_rate', payload.vat_rate);
    payload.items.forEach((item, index) => {
      append(`items[${index}][service_id]`, item.service_id);
      append(`items[${index}][product_id]`, item.product_id);
      append(`items[${index}][label]`, item.label);
      append(`items[${index}][unit_price]`, item.unit_price);
      append(`items[${index}][quantity]`, item.quantity);
      append(`items[${index}][pass_tier]`, item.pass_tier);
    });
    const { data } = await client.post<Invoice>('/invoices', formData);
    return data;
  },

  async get(id: string): Promise<Invoice> {
    const { data } = await client.get<Invoice>(`/invoices/${id}`);
    return data;
  },

  async update(id: string, payload: UpdateInvoicePayload): Promise<Invoice> {
    const { data } = await client.put<Invoice>(`/invoices/${id}`, payload);
    return data;
  },

  async pay(id: string, payload: PayInvoicePayload): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/payments`, payload);
    return data;
  },

  /** Règle le reste à payer d'une facture partielle : montant + moyen + preuve,
   *  transmis au caissier pour validation (encaissement automatique à l'acceptation). */
  async payRemaining(id: string, payload: PayRemainingPayload): Promise<{ payment_proof: PaymentProof; url: string }> {
    const formData = new FormData();
    formData.append('amount', String(payload.amount));
    formData.append('payment_method', payload.payment_method);
    if (payload.phone_number_used) formData.append('phone_number_used', payload.phone_number_used);
    if (payload.reference) formData.append('reference', payload.reference);
    formData.append('file', payload.file);
    const { data } = await client.post<{ payment_proof: PaymentProof; url: string }>(
      `/invoices/${id}/pay-remaining`,
      formData,
    );
    return data;
  },

  async cancel(id: string): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/cancel`);
    return data;
  },

  async validate(id: string): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/validate`);
    return data;
  },

  async reject(id: string, payload: RejectInvoicePayload): Promise<Invoice> {
    const { data } = await client.post<Invoice>(`/invoices/${id}/reject`, payload);
    return data;
  },

  async listProofs(params: ProofListParams = {}): Promise<PaginatedResponse<PaymentProof>> {
    const { data } = await client.get<PaginatedResponse<PaymentProof>>('/payment-proofs', { params });
    return data;
  },

  async approveProof(proofId: string): Promise<ProofReviewResponse> {
    const { data } = await client.post<ProofReviewResponse>(`/payment-proofs/${proofId}/approve`);
    return data;
  },

  async rejectProof(proofId: string, notes: string): Promise<ProofReviewResponse> {
    const { data } = await client.post<ProofReviewResponse>(`/payment-proofs/${proofId}/reject`, { notes });
    return data;
  },
};
