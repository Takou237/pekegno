import type { Role } from './auth';

export interface UserAssignment {
  id: string;
  name: string;
  pivot: {
    department_id: string | null;
    is_primary: boolean;
  };
}

export interface UserListItem {
  id: string;
  username: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  role: Role | null;
  role_id: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListParams {
  search?: string;
  is_active?: boolean;
  per_page?: number;
  page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role_id?: string | null;
  is_active?: boolean;
  password?: string;
  password_confirmation?: string;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
}
