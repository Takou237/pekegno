import { client } from './client';
import type { Order, Invoice, FormationEnrollment, Attendance, LearnerObservation, LearnerProfile, PaginatedResponse, PaymentProof } from '@/types';

export interface CheckoutLine {
  line_type?: 'catalog' | 'manual';
  service_id?: string;
  product_id?: string;
  label?: string;
  description?: string;
  unit_price?: number;
  quantity?: number;
}

export const clientApi = {
  async getOrders(): Promise<PaginatedResponse<Order>> {
    const { data } = await client.get('/client/orders');
    return data;
  },

  async getOrder(id: string): Promise<Order> {
    const { data } = await client.get(`/client/orders/${id}`);
    return data;
  },

  async checkout(payload: { agency_id: string; lines: CheckoutLine[] }): Promise<{ order: Order; invoice: Invoice }> {
    const { data } = await client.post('/client/checkout', payload);
    return data;
  },

  async getInvoices(): Promise<PaginatedResponse<Invoice>> {
    const { data } = await client.get('/client/invoices');
    return data;
  },

  async getInvoice(id: string): Promise<Invoice> {
    const { data } = await client.get(`/client/invoices/${id}`);
    return data;
  },

  async deleteInvoice(id: string): Promise<{ message: string }> {
    const { data } = await client.delete(`/client/invoices/${id}`);
    return data;
  },

  async downloadReceipt(invoiceId: string): Promise<Blob> {
    const { data } = await client.get<Blob>(`/client/invoices/${invoiceId}/receipt`, { responseType: 'blob' });
    return data;
  },

  async uploadPaymentProof(invoiceId: string, formData: FormData): Promise<{ payment_proof: PaymentProof; url: string }> {
    const { data } = await client.post(`/client/invoices/${invoiceId}/payment-proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async getEnrollments(): Promise<PaginatedResponse<FormationEnrollment>> {
    const { data } = await client.get('/client/enrollments');
    return data;
  },

  async enroll(payload: { course_id: string; training_session_id?: string }): Promise<FormationEnrollment> {
    const { data } = await client.post('/client/enrollments', payload);
    return data;
  },

  async getLearnerProfile(): Promise<LearnerProfile> {
    const { data } = await client.get('/client/learner-profile');
    return data;
  },

  async getAttendances(): Promise<PaginatedResponse<Attendance>> {
    const { data } = await client.get('/client/attendances');
    return data;
  },

  async getObservations(): Promise<PaginatedResponse<LearnerObservation>> {
    const { data } = await client.get('/client/observations');
    return data;
  },

  async addObservation(payload: { course_module_id: string; content: string }): Promise<LearnerObservation> {
    const { data } = await client.post('/client/observations', payload);
    return data;
  },
};
