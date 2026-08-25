export interface Company {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
  prospects_count?: number;
  opportunities_count?: number;
  prospects?: unknown[];
  opportunities?: unknown[];
}

export interface CompanyPayload {
  name: string;
  industry?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
}

export interface CompanyListParams {
  search?: string;
  industry?: string;
  per_page?: number;
}

export interface CompanyListResponse {
  data: Company[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}
