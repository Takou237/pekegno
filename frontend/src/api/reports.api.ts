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

export const reportsApi = {
  async commercialReport(params: CommercialReportParams = {}): Promise<CommercialReportResponse> {
    const { data } = await client.get<CommercialReportResponse>('/commercials/report', { params });
    return data;
  },
};
