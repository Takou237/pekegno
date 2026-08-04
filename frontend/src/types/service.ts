import type { Agency, Department } from '@/types/agency';
import type { Category } from '@/types/category';

export type FormationType = 'presentiel' | 'distanciel';

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

export interface FormationBrief {
  id: string;
  type: FormationType;
  duration: string | null;
  conditions: string | null;
  deposit_amount: string | null;
  installments_count: number | null;
  online_payment: boolean;
}

export interface Service {
  id: string;
  agency_id: string | null;
  department_id: string | null;
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
  is_formation: boolean;
  category?: Category | null;
  agency?: Agency | null;
  department?: Department | null;
  promotions?: Promotion[];
  price_history?: PriceHistoryEntry[];
  formation?: FormationBrief | null;
}

export interface FormationPayload {
  type: FormationType;
  duration?: string | null;
  conditions?: string | null;
  deposit_amount?: string | number | null;
  installments_count?: number | null;
  online_payment?: boolean;
}

export interface ServicePayload {
  name: string;
  category_id: string;
  agency_id?: string | null;
  department_id?: string | null;
  price: number | string;
  description?: string | null;
  cover_image?: string | null;
  presentation_video?: string | null;
  formation?: FormationPayload | null;
}

export interface ServiceListParams {
  search?: string;
  category_id?: string;
  agency_id?: string;
  department_id?: string;
  is_formation?: boolean;
  per_page?: number;
  page?: number;
  sort_by?: 'name' | 'price' | 'created_at';
  sort_order?: 'asc' | 'desc';
  with?: string;
}
