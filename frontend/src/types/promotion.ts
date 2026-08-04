import type { Service } from './service';

export interface Promotion {
  id: string;
  service_id: string;
  promo_price: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  service?: Service | null;
  created_at?: string;
}

export interface PromotionPayload {
  promo_price: string | number;
  start_date: string;
  end_date: string;
}

export interface PromotionListParams {
  agency_id?: string;
  service_id?: string;
  status?: 'active' | 'upcoming' | 'expired';
  per_page?: number;
  page?: number;
}
