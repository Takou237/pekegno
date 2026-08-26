import { client } from './client';
import type { Contract, ContractPayload } from '@/types/contract';

export const contractsApi = {
  list(params?: { agency_id?: string; status?: string; client_id?: string; search?: string; page?: number; per_page?: number }) {
    return client.get('/contracts', { params }).then((r) => r.data);
  },
  get(id: string): Promise<Contract> {
    return client.get(`/contracts/${id}`).then((r) => r.data);
  },
  create(payload: ContractPayload): Promise<Contract> {
    return client.post('/contracts', payload).then((r) => r.data);
  },
  update(id: string, payload: Partial<ContractPayload>): Promise<Contract> {
    return client.put(`/contracts/${id}`, payload).then((r) => r.data);
  },
  renew(id: string): Promise<{ message: string; contract: Contract }> {
    return client.post(`/contracts/${id}/renew`).then((r) => r.data);
  },
  terminate(id: string, reason: string): Promise<{ message: string }> {
    return client.post(`/contracts/${id}/terminate`, { terminated_reason: reason }).then((r) => r.data);
  },
};
