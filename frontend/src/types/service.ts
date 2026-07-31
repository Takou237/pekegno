import type { Category } from './category';

export type ServiceCategoryRef = Category;

export interface ServiceAgencyRef {
  id: string;
  name: string;
}

export interface ServiceDepartmentRef {
  id: string;
  name: string;
}

export interface Promotion {
  id: string;
  service_id: string;
  service?: { id: string; name: string };
  promotional_price: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: string;
  service_id: string;
  price: string;
  changed_by: string;
  changed_by_name?: string | null;
  reason?: string | null;
  created_at: string | null;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  coverage: string | null;
  presentation_video: string | null;
  category_id: string;
  category?: ServiceCategoryRef | null;
  agency_id: string | null;
  agency?: ServiceAgencyRef | null;
  department_id: string | null;
  department?: ServiceDepartmentRef | null;
  current_price: string;
  has_active_promotion: boolean;
  active_promotion?: Promotion | null;
  promotions?: Promotion[];
  price_history?: PriceHistory[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServicePayload {
  name: string;
  category_id: string;
  price: string | number;
  agency_id?: string | null;
  department_id?: string | null;
  coverage?: string | null;
  description?: string | null;
  presentation_video?: string | null;
  reason?: string | null;
}

export interface ServiceListParams {
  search?: string;
  category_id?: string;
  agency_id?: string;
  department_id?: string;
  with_promotions?: boolean;
  per_page?: number;
  page?: number;
  sort_by?: 'name' | 'price' | 'created_at';
  sort_order?: 'asc' | 'desc';
  with?: string;
}

export interface PromotionPayload {
  promotional_price: string | number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}
