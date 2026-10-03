import { client } from './client';
import type { Contract, ContractListParams, ContractPayload } from '@/types/contract';
import type { LaravelPage } from '@/types/agencyDepartment';

export const contractsApi = {
  list(params?: ContractListParams): Promise<LaravelPage<Contract>> {
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
  /** Retourne le nouveau contrat (enfant). */
  renew(id: string): Promise<Contract> {
    return client.post(`/contracts/${id}/renew`).then((r) => r.data);
  },
  terminate(id: string, reason: string): Promise<Contract> {
    return client.post(`/contracts/${id}/terminate`, { reason }).then((r) => r.data);
  },
  suspend(id: string, reason: string): Promise<Contract> {
    return client.post(`/contracts/${id}/suspend`, { reason }).then((r) => r.data);
  },
  resume(id: string): Promise<Contract> {
    return client.post(`/contracts/${id}/resume`).then((r) => r.data);
  },
  /** PDF signé facultatif (D10) : le fichier est d'abord envoyé via /uploads. */
  sign(id: string, signed_document_path: string): Promise<Contract> {
    return client.post(`/contracts/${id}/sign`, { signed_document_path }).then((r) => r.data);
  },
  pdf(id: string): Promise<Blob> {
    return client.get(`/contracts/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data as Blob);
  },
};
