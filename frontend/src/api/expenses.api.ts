import { client } from './client';
import type {
  Expense,
  ExpenseCreatePayload,
  ExpenseListParams,
  ExpenseListResponse,
} from '@/types/expenses';

export const expensesApi = {
  list(params?: ExpenseListParams): Promise<ExpenseListResponse> {
    return client.get('/expenses', { params }).then((r) => r.data);
  },

  get(id: string): Promise<Expense> {
    return client.get(`/expenses/${id}`).then((r) => r.data);
  },

  create(payload: ExpenseCreatePayload): Promise<Expense> {
    return client.post('/expenses', payload).then((r) => r.data);
  },

  update(id: string, payload: Partial<ExpenseCreatePayload>): Promise<Expense> {
    return client.put(`/expenses/${id}`, payload).then((r) => r.data);
  },

  remove(id: string): Promise<void> {
    return client.delete(`/expenses/${id}`).then((r) => r.data);
  },

  submit(id: string): Promise<Expense> {
    return client.post(`/expenses/${id}/submit`).then((r) => r.data);
  },

  approve(id: string): Promise<Expense> {
    return client.post(`/expenses/${id}/approve`).then((r) => r.data);
  },

  reject(id: string, reason: string): Promise<Expense> {
    return client.post(`/expenses/${id}/reject`, { reason }).then((r) => r.data);
  },

  pay(id: string, treasury_account_id: string): Promise<Expense> {
    return client.post(`/expenses/${id}/pay`, { treasury_account_id }).then((r) => r.data);
  },

  close(id: string): Promise<Expense> {
    return client.post(`/expenses/${id}/close`).then((r) => r.data);
  },

  reopen(id: string): Promise<Expense> {
    return client.post(`/expenses/${id}/reopen`).then((r) => r.data);
  },
};
