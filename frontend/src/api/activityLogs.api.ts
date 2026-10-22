import { client } from './client';
import type { ActivityLog, ActivityLogParams } from '@/types/activityLog';
import type { PaginatedResponse } from '@/types/agency';

interface LaravelPaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export const activityLogsApi = {
  async list(params: ActivityLogParams = {}): Promise<PaginatedResponse<ActivityLog>> {
    const { data } = await client.get<LaravelPaginatedResponse<ActivityLog>>('/activity-logs', { params });
    return {
      data: data.data,
      meta: {
        current_page: data.current_page,
        last_page: data.last_page,
        per_page: data.per_page,
        total: data.total,
      },
    };
  },
};
