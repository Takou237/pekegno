import type { Agency } from './agency';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  agency_id: string;
  agency?: Agency;
  agency_chief?: {
    id: string;
    name: string;
    email: string;
  } | null;
  department_chief?: {
    id: string;
    name: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DepartmentListParams {
  search?: string;
  agency_id?: string;
  per_page?: number;
  page?: number;
  with?: string;
}

export interface DepartmentPayload {
  agency_id: string;
  name: string;
  description?: string;
}
