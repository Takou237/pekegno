export interface ActivityLog {
  id: string;
  user_id: string | null;
  agency_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
  agency?: { id: string; name: string; code: string } | null;
}

export interface ActivityLogParams {
  user_id?: string;
  entity_type?: string;
  action?: string;
  agency_id?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}
