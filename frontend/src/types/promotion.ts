import type { Produit } from './produit';

export type PromotionType = 'amount' | 'percent';

export interface Promotion {
  id: string;
  service_id: string;
  type: PromotionType;
  promo_price: string | null;
  discount_percent: string | null;
  effective_price: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  service?: Produit | null;
  created_at?: string;
}

export interface PromotionPayload {
  type: PromotionType;
  promo_price?: string | number | null;
  discount_percent?: string | number | null;
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
