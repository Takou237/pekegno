import { client } from './client';
import type { ActivityLog, ActivityLogParams } from '@/types/activityLog';
import type { PaginatedResponse } from '@/types/agency';

export const activityLogsApi = {
  async list(params: ActivityLogParams = {}): Promise<PaginatedResponse<ActivityLog>> {
    const { data } = await client.get<PaginatedResponse<ActivityLog>>('/activity-logs', { params });
    return data;
  },
};
