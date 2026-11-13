import { client } from './client';
import type {
  AdCampaign,
  AdCampaignListParams,
  AdCampaignListResponse,
  AdCampaignPayload,
} from '@/types/adCampaign';

/** T3.8 — campagnes publicitaires Pekegno (locales et nationales). */
export const adCampaignsApi = {
  list(params?: AdCampaignListParams): Promise<AdCampaignListResponse> {
    return client.get('/ad-campaigns', { params }).then((r) => r.data);
  },

  create(payload: AdCampaignPayload): Promise<AdCampaign> {
    return client.post('/ad-campaigns', payload).then((r) => r.data);
  },

  update(id: string, payload: AdCampaignPayload): Promise<AdCampaign> {
    return client.put(`/ad-campaigns/${id}`, payload).then((r) => r.data);
  },

  remove(id: string): Promise<void> {
    return client.delete(`/ad-campaigns/${id}`).then((r) => r.data);
  },
};
