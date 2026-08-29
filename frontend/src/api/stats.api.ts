import { client } from './client';
import type {
  AgencyStats,
  CategorySales,
  DashboardStats,
  GroupStats,
  MonthlyRevenuePoint,
  PaymentMethodStat,
  TopAgency,
  TopCommercial,
  TopProduct,
  GroupReportStats,
} from '@/types/stats';

export const statsApi = {
  async dashboard(params: { from?: string; to?: string } = {}): Promise<DashboardStats> {
    const { data } = await client.get<DashboardStats>('/stats/dashboard', { params });
    return data;
  },

  async group(params: { from?: string; to?: string } = {}): Promise<GroupStats> {
    const { data } = await client.get<GroupStats>('/stats/group', { params });
    return data;
  },

  async country(countryId: string, params: { from?: string; to?: string } = {}): Promise<DashboardStats> {
    const { data } = await client.get<DashboardStats>(`/stats/country/${countryId}`, { params });
    return data;
  },

  async agency(agencyId: string, params: { from?: string; to?: string } = {}): Promise<AgencyStats> {
    const { data } = await client.get<AgencyStats>(`/stats/agency/${agencyId}`, { params });
    return data;
  },

  async monthlyRevenue(params: { months?: number; agencyId?: string; countryId?: string } = {}): Promise<MonthlyRevenuePoint[]> {
    const { data } = await client.get<MonthlyRevenuePoint[]>('/stats/monthly-revenue', {
      params: { months: params.months, agency_id: params.agencyId, country_id: params.countryId },
    });
    return data;
  },

  async topCommercials(params: { limit?: number; from?: string } = {}): Promise<TopCommercial[]> {
    const { data } = await client.get<TopCommercial[]>('/stats/top-commercials', { params });
    return data;
  },

  async salesByCategory(params: { from?: string; to?: string } = {}): Promise<CategorySales[]> {
    const { data } = await client.get<CategorySales[]>('/stats/sales-by-category', { params });
    return data;
  },

  async paymentMethods(params: { from?: string; to?: string } = {}): Promise<PaymentMethodStat[]> {
    const { data } = await client.get<PaymentMethodStat[]>('/stats/payment-methods', { params });
    return data;
  },

  async topProducts(params: { limit?: number; from?: string; to?: string } = {}): Promise<TopProduct[]> {
    const { data } = await client.get<TopProduct[]>('/stats/top-products', { params });
    return data;
  },

  async topAgencies(params: { limit?: number; from?: string; to?: string } = {}): Promise<TopAgency[]> {
    const { data } = await client.get<TopAgency[]>('/stats/top-agencies', { params });
    return data;
  },

  async trainingGroup(): Promise<GroupReportStats> {
    const { data } = await client.get<GroupReportStats>('/stats/training-group');
    return data;
  },
};
