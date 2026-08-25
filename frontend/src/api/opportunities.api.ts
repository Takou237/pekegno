import { client } from './client';
import type { Opportunity, OpportunityListResponse, OpportunityPayload, PipelineEntry, OpportunityStage } from '../types/opportunity';

export const opportunitiesApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<OpportunityListResponse>('/opportunities', { params }),

  get: (id: string) =>
    client.get<Opportunity>(`/opportunities/${id}`),

  create: (data: OpportunityPayload) =>
    client.post<Opportunity>('/opportunities', data),

  update: (id: string, data: Partial<OpportunityPayload>) =>
    client.put<Opportunity>(`/opportunities/${id}`, data),

  remove: (id: string) =>
    client.delete(`/opportunities/${id}`),

  changeStage: (id: string, stage: OpportunityStage, lossReason?: string) =>
    client.post<Opportunity>(`/opportunities/${id}/stage`, { stage, loss_reason: lossReason }),

  pipeline: () =>
    client.get<PipelineEntry[]>('/opportunities/pipeline'),
};
