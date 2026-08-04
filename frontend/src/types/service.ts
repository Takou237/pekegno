import type { Agency } from '@/types/agency';
import type { Category } from '@/types/category';

export interface Promotion {
  id: string;
  service_id: string;
  promo_price: string;
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

export interface Service {
  id: string;
  agency_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  effective_price: string;
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

export interface ServicePayload {
  name: string;
  category_id: string;
  agency_id: string;
  price: number | string;
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
