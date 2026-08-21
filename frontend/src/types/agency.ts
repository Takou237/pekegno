export interface Department {
  id: string;
  name: string;
  description: string | null;
  agency_id: string;
  created_at: string;
  updated_at: string;
}

export interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  pivot?: {
    department_id: string | null;
    is_primary: boolean;
    is_department_chief: boolean;
  };
}

export interface AgencyActivity {
  id: string;
  type: 'agency' | 'academy';
  is_active: boolean;
}

export interface Agency {
  id: string;
  code: string;
  name: string;
  country: string;
  city: string | null;
  country_id?: string | null;
  city_id?: string | null;
  address: string | null;
  full_address: string | null;
  phone: string | null;
  email: string | null;
  type: 'agency' | 'academy' | 'mixed';
  activities?: AgencyActivity[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  departments: Department[];
  assigned_users: AssignedUser[];
}

export interface AgencyPayload {
  name: string;
  country: string;
  country_id?: string | null;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  activities?: { type: 'agency' | 'academy'; is_active: boolean }[];
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Forme réelle renvoyée par AnonymousResourceCollection::paginate() de Laravel. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  links?: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

export interface AgencyListParams {
  search?: string;
  country?: string;
  country_id?: string;
  type?: 'agency' | 'academy' | 'mixed';
  per_page?: number;
  page?: number;
  sort_by?: 'name' | 'code' | 'country' | 'created_at';
  sort_order?: 'asc' | 'desc';
  with?: string;
}
