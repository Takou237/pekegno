import { client } from './client';
import type { Department, DepartmentListParams, DepartmentPayload } from '@/types/department';
import type { PaginatedResponse } from '@/types/agency';

export const departmentsApi = {
  async list(params: DepartmentListParams = {}): Promise<PaginatedResponse<Department>> {
    const { data } = await client.get<PaginatedResponse<Department>>('/departments', { params });
    return data;
  },

  async get(id: string): Promise<Department> {
    const { data } = await client.get<Department>(`/departments/${id}`);
    return data;
  },

  async create(payload: DepartmentPayload): Promise<Department> {
    const { data } = await client.post<Department>('/departments', payload);
    return data;
  },

  async update(id: string, payload: Partial<DepartmentPayload>): Promise<Department> {
    const { data } = await client.put<Department>(`/departments/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/departments/${id}`);
  },

  async trash(params: DepartmentListParams = {}): Promise<PaginatedResponse<Department>> {
    const { data } = await client.get<PaginatedResponse<Department>>('/departments/trash', {
      params,
    });
    return data;
  },

  async restore(id: string): Promise<Department> {
    const { data } = await client.post<Department>(`/departments/${id}/restore`);
    return data;
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/departments/${id}/force-delete`);
  },
};
