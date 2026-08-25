import { client } from './client';
import type { Activity, ActivityListResponse, ActivityPayload } from '../types/activity';

export const activitiesApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<ActivityListResponse>('/activities', { params }),

  get: (id: string) =>
    client.get<Activity>(`/activities/${id}`),

  create: (data: ActivityPayload) =>
    client.post<Activity>('/activities', data),

  update: (id: string, data: Partial<ActivityPayload>) =>
    client.put<Activity>(`/activities/${id}`, data),

  remove: (id: string) =>
    client.delete(`/activities/${id}`),

  complete: (id: string, outcome?: string) =>
    client.post<Activity>(`/activities/${id}/complete`, { outcome }),

  timeline: (subjectType: string, subjectId: string) =>
    client.get<Activity[]>('/crm/timeline', { params: { subject_type: subjectType, subject_id: subjectId } }),
};
