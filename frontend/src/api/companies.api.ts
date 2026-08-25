import { client } from './client';
import type { Company, CompanyListResponse, CompanyPayload } from '../types/company';

export const companiesApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<CompanyListResponse>('/companies', { params }),

  get: (id: string) =>
    client.get<Company>(`/companies/${id}`),

  create: (data: CompanyPayload) =>
    client.post<Company>('/companies', data),

  update: (id: string, data: Partial<CompanyPayload>) =>
    client.put<Company>(`/companies/${id}`, data),

  remove: (id: string) =>
    client.delete(`/companies/${id}`),

  search: (q: string) =>
    client.get<Company[]>('/companies/search', { params: { q } }),
};
