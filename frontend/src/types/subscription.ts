export interface SubscriptionPackService {
  id: string;
  subscription_pack_id: string;
  service_id: string;
  price_per_month: string;
  service?: {
    id: string;
    name: string;
    price: string;
  };
}

export interface SubscriptionPack {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  price_per_month: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pack_services?: SubscriptionPackService[];
  agency?: { id: string; name: string } | null;
}

export interface Subscription {
  id: string;
  subscription_pack_id: string;
  agency_id: string;
  client_id: string;
  months: number;
  price_per_month: string;
  total_price: string;
  start_date: string;
  end_date: string;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  pack?: SubscriptionPack | null;
  agency?: { id: string; name: string } | null;
  client?: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

export interface SubscriptionListParams {
  agency_id?: string;
  client_id?: string;
  per_page?: number;
  page?: number;
}

export interface SubscriptionPackPayload {
  agency_id: string;
  name: string;
  description?: string | null;
  price_per_month?: number;
  is_active?: boolean;
  services?: { service_id: string }[];
}

export interface CreateSubscriptionPayload {
  subscription_pack_id: string;
  agency_id: string;
  client_id: string;
  months: number;
  advance?: number;
}
