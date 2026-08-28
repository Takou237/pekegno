import { client } from './client';
import type { CourseCategory, CourseCategoryPayload } from '@/types/category';
import type { PaginatedResponse } from '@/types/agency';

export interface CourseCategoryListParams {
  search?: string;
  per_page?: number;
  page?: number;
  sort_by?: 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

function unwrap(data: { data?: CourseCategory } & CourseCategory): CourseCategory {
  return data.data ?? data;
}

export const courseCategoriesApi = {
  async list(params: CourseCategoryListParams = {}): Promise<PaginatedResponse<CourseCategory>> {
    const { data } = await client.get<PaginatedResponse<CourseCategory>>('/course-categories', {
      params,
    });
    return data;
  },

  async get(id: string): Promise<CourseCategory> {
    const { data } = await client.get(`/course-categories/${id}`);
    return unwrap(data);
  },

  async create(payload: CourseCategoryPayload): Promise<CourseCategory> {
    const { data } = await client.post(`/course-categories`, payload);
    return unwrap(data);
  },

  async update(id: string, payload: Partial<CourseCategoryPayload>): Promise<CourseCategory> {
    const { data } = await client.put(`/course-categories/${id}`, payload);
    return unwrap(data);
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/course-categories/${id}`);
  },

  async trash(params: CourseCategoryListParams = {}): Promise<PaginatedResponse<CourseCategory>> {
    const { data } = await client.get<PaginatedResponse<CourseCategory>>(
      '/course-categories/trash',
      { params }
    );
    return data;
  },

  async restore(id: string): Promise<CourseCategory> {
    const { data } = await client.post(`/course-categories/${id}/restore`);
    return unwrap(data);
  },

  async forceDelete(id: string): Promise<void> {
    await client.delete(`/course-categories/${id}/force-delete`);
  },
};