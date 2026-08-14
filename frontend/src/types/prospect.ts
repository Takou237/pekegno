export interface Prospect {
  id: string;
  commercial_id: string;
  agency_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
  created_by: string | null;
  full_name?: string;
  created_at: string;
  updated_at: string;
  commercial?: { id: string; first_name: string; last_name: string; email: string | null } | null;
  agency?: { id: string; name: string } | null;
}

export interface ProspectPayload {
  commercial_id?: string | null;
  agency_id?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface ProspectListParams {
  search?: string;
  commercial_id?: string;
  agency_id?: string;
  per_page?: number;
  page?: number;
}

export interface ConvertedClient {
  id: string;
  client_number?: string | null;
  email?: string | null;
}
