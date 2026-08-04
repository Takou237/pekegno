import type { Role } from './auth';

export interface UserAssignment {
  id: string;
  name: string;
  pivot: {
    department_id: string | null;
    is_primary: boolean;
    is_department_chief: boolean;
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
  assignments?: UserAssignment[];
}

export interface UserListParams {
  search?: string;
  is_active?: boolean;
  agency_id?: string;
  department_id?: string;
  per_page?: number;
  page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  with?: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_id?: string;
  agency_id?: string;
  department_id?: string;
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

export interface Permission {
  id: string;
  name: string;
  label?: string | null;
  description: string | null;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  permissions?: Permission[];
}

export interface RolePayload {
  name: string;
  description?: string;
  permissions?: string[];
}

export interface PermissionPayload {
  name: string;
  label?: string;
  description?: string;
}
