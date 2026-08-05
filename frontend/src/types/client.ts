import type { Role } from './auth';

export interface ClientListItem {
  id: string;
  username: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  client_number: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  is_active: boolean;
  role: Role | null;
  role_id: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientListParams {
  search?: string;
  agency_id?: string;
  per_page?: number;
  page?: number;
}

export interface ClientPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  password?: string;
  password_confirmation?: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  is_active?: boolean;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
  city?: string;
  country?: string;
  address?: string;
}
