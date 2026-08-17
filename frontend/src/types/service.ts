import type { Agency } from '@/types/agency';
import type { Category } from '@/types/category';

export interface Promotion {
  id: string;
  service_id: string;
  type?: 'amount' | 'percent';
  promo_price: string | null;
  discount_percent: string | null;
  effective_price?: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface PriceHistoryEntry {
  id: string;
  service_id: string;
  price: string;
  changed_at: string;
}

export interface SeminarTier {
  tier: 'classique' | 'premium' | 'vip';
  label: string;
  price: string;
  description: string | null;
}

export interface Service {
  id: string;
  agency_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  effective_price: string;
  bonus_fixed: string | null;
  is_seminar: boolean;
  seminar_tiers: SeminarTier[];
  cover_image: string | null;
  presentation_video: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: Category | null;
  agency?: Agency | null;
  promotions?: Promotion[];
  price_history?: PriceHistoryEntry[];
}

export interface ServiceSearchItem {
  id: string;
  name: string;
  price: string;
  effective_price: string;
  has_promotion: boolean;
  category: string | null;
  is_seminar?: boolean;
  seminar_tiers?: SeminarTier[];
}

export interface ServicePayload {
  name: string;
  category_id: string;
  agency_id: string;
  price: number | string;
  bonus_fixed?: number | string | null;
  is_seminar?: boolean;
  tiers?: { tier: string; label: string; price: number | string; description?: string | null }[];
  description?: string | null;
  cover_image?: string | null;
  presentation_video?: string | null;
}

export interface ServiceListParams {
  search?: string;
  category_id?: string;
  agency_id?: string;
  per_page?: number;
  page?: number;
  sort_by?: 'name' | 'price' | 'created_at';
  sort_order?: 'asc' | 'desc';
  with?: string;
}
