import { client } from './client';
import type { Certificate, CertificatePayload } from '@/types/certificate';

export const certificatesApi = {
  list(params?: { status?: string; page?: number; per_page?: number }) {
    return client.get('/certificates', { params }).then((r) => r.data);
  },
  get(id: string): Promise<Certificate> {
    return client.get(`/certificates/${id}`).then((r) => r.data);
  },
  create(payload: CertificatePayload): Promise<Certificate> {
    return client.post('/certificates', payload).then((r) => r.data);
  },
  revoke(id: string, reason: string): Promise<Certificate> {
    return client.post(`/certificates/${id}/revoke`, { revoked_reason: reason }).then((r) => r.data);
  },
};
