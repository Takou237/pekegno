import { client } from './client';

export interface CommercialReportParams {
  agency_id?: string;
  commercial_id?: string;
  kind?: string;
  from?: string;
  to?: string;
}

export interface CommercialReportTotals {
  sales_count: number;
  revenue_billed: number;
  revenue_received: number;
  payments_count: number;
  commissions: number;
  points: number;
  prospects_count: number;
  clients_converted: number;
}

export interface CommercialReportRankingEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  kind: string;
  agency_id: string | null;
  agency_name: string | null;
  sales_count: number;
  revenue_billed: number;
  revenue_received: number;
  payments_count: number;
  commissions: number;
  points: number;
  prospects_count: number;
  clients_converted: number;
  conversion_rate: number;
}

export interface CommercialReportResponse {
  period: { from: string; to: string };
  totals: CommercialReportTotals;
  ranking: CommercialReportRankingEntry[];
}

export interface ReportDateParams {
  from?: string;
  to?: string;
}

export interface SubscriptionsReportResponse {
  period: { from: string; to: string };
  totals: {
    subscriptions: number;
    active: number;
    renewed: number;
    cancelled: number;
    expired: number;
    expiring_soon: number;
    mr_maintenu: number;
  };
  by_status: Record<string, { count: number; mrr: number }>;
  by_pack: Array<{ pack: string; count: number; revenue: number }>;
  trend: Array<{ month: string; new_subscriptions: number }>;
}

export interface CustomersReportResponse {
  period: { from: string; to: string };
  totals: {
    clients_total: number;
    clients_new: number;
    clients_active: number;
    turnover: number;
  };
  by_country: Array<{ country: string; count: number }>;
  by_city: Array<{ city: string; count: number }>;
  top_clients: Array<{ client_id: string; client: string; turnover: number; orders: number }>;
  by_commercial: Array<{ commercial_id: string; commercial: string; turnover: number; orders: number }>;
}

export type ComparisonDimension = 'country' | 'city' | 'agency';

export interface ComparisonReportResponse {
  dimension: ComparisonDimension;
  period: { from: string; to: string };
  total_revenue: number;
  data: Array<{ id: string | null; label: string; revenue: number; invoices: number; share: number }>;
}

export interface CommercialMonthlyTotals {
  lines: number;
  clients: number;
  billed: number;
  received: number;
  balance_due: number;
  collection_rate: number;
}

export interface CommercialMonthlyActivityRow {
  activity: string;
  lines: number;
  billed: number;
  received: number;
  balance: number;
}

export interface CommercialMonthlyCityRow {
  city: string;
  lines: number;
  billed: number;
  received: number;
  balance: number;
  share: number;
}

export interface CommercialMonthlyWeekRow {
  week: number;
  start: string;
  end: string;
  lines: number;
  billed: number;
  received: number;
}

export interface CommercialMonthlyAnnexeRow {
  date: string;
  client: string;
  city: string;
  activity: string;
  total: number;
  paid: number;
  balance: number;
}

export interface CommercialMonthlyTab {
  totals: CommercialMonthlyTotals;
  by_activity: CommercialMonthlyActivityRow[];
  by_city: CommercialMonthlyCityRow[];
  by_week: CommercialMonthlyWeekRow[];
  annexe: CommercialMonthlyAnnexeRow[];
}

export interface CommercialMonthlyResponse {
  commercial: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    agency_id: string | null;
    agency_name: string | null;
  };
  period: { from: string; to: string };
  totals: CommercialMonthlyTotals;
  tabs: {
    academy: CommercialMonthlyTab;
    agency: CommercialMonthlyTab;
  };
}

export type SalesTrackingType = 'academy' | 'agency';

export type SalesTrackingStatus = 'unpaid' | 'partial' | 'paid';

export interface SalesTrackingLine {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  client_id: string | null;
  client: string;
  city: string;
  activity: string;
  type: SalesTrackingType;
  quantity: number;
  billed: number;
  paid: number;
  balance: number;
  status: SalesTrackingStatus;
}

export interface SalesTrackingTotals {
  lines: number;
  billed: number;
  received: number;
  balance_due: number;
  collection_rate: number;
}

export interface SalesTrackingResponse {
  data: SalesTrackingLine[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  totals: SalesTrackingTotals;
}

export interface SalesTrackingParams {
  from?: string;
  to?: string;
  commercial_id?: string;
  seller_user_id?: string;
  cashier_id?: string;
  agency_id?: string;
  city?: string;
  activity?: string;
  type?: SalesTrackingType;
  status?: SalesTrackingStatus;
  search?: string;
  page?: number;
  per_page?: number;
}

export const reportsApi = {
  async commercialReport(params: CommercialReportParams = {}): Promise<CommercialReportResponse> {
    const { data } = await client.get<CommercialReportResponse>('/commercials/report', { params });
    return data;
  },

  async salesTracking(params: SalesTrackingParams = {}): Promise<SalesTrackingResponse> {
    const { data } = await client.get<SalesTrackingResponse>('/sales-tracking', { params });
    return data;
  },

  async commercialMonthly(
    params: { commercial_id?: string; from?: string; to?: string } = {}
  ): Promise<CommercialMonthlyResponse> {
    const { data } = await client.get<CommercialMonthlyResponse>('/commercials/report/detail', { params });
    return data;
  },

  async subscriptions(params: ReportDateParams & { agency_id?: string; country_id?: string } = {}): Promise<SubscriptionsReportResponse> {
    const { data } = await client.get<SubscriptionsReportResponse>('/reports/subscriptions', { params });
    return data;
  },

  async customers(params: ReportDateParams & { agency_id?: string; country_id?: string; limit?: number } = {}): Promise<CustomersReportResponse> {
    const { data } = await client.get<CustomersReportResponse>('/reports/customers', { params });
    return data;
  },

  async comparison(params: ReportDateParams & { dimension?: ComparisonDimension; agency_id?: string; country_id?: string } = {}): Promise<ComparisonReportResponse> {
    const { data } = await client.get<ComparisonReportResponse>('/reports/comparison', { params });
    return data;
  },
};
