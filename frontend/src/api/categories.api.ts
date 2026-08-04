import { client } from './client';
import type { Category, CategoryPayload } from '@/types/category';
import type { PaginatedResponse } from '@/types/agency';

export interface CategoryListParams {
  search?: string;
  per_page?: number;
  page?: number;
  sort_by?: 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export const categoriesApi = {
  async list(params: CategoryListParams = {}): Promise<PaginatedResponse<Category>> {
    const { data } = await client.get<PaginatedResponse<Category>>('/categories', { params });
    return data;
  },

  async get(id: string): Promise<Category> {
    const { data } = await client.get<Category>(`/categories/${id}`);
    return data;
  },

  async create(payload: CategoryPayload): Promise<Category> {
    const { data } = await client.post<Category>('/categories', payload);
    return data;
  },

  async update(id: string, payload: Partial<CategoryPayload>): Promise<Category> {
    const { data } = await client.put<Category>(`/categories/${id}`, payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/categories/${id}`);
  },

  async trash(params: CategoryListParams = {}): Promise<PaginatedResponse<Category>> {
    const { data } = await client.get<PaginatedResponse<Category>>('/categories/trash', {
      params,
    });
    return data;
  },

  async restore(id: string): Promise<Category> {
    const { data } = await client.post<Category>(`/categories/${id}/restore`);
    return data;
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/categories/${id}/force-delete`);
  },
};
