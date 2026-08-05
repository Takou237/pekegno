import { client } from './client';
import type {
  AgencyStats,
  CategorySales,
  DashboardStats,
  MonthlyRevenuePoint,
  PaymentMethodStat,
  TopCommercial,
} from '@/types/stats';

export const statsApi = {
  async dashboard(params: { from?: string; to?: string } = {}): Promise<DashboardStats> {
    const { data } = await client.get<DashboardStats>('/stats/dashboard', { params });
    return data;
  },

  async agency(agencyId: string, params: { from?: string; to?: string } = {}): Promise<AgencyStats> {
    const { data } = await client.get<AgencyStats>(`/stats/agency/${agencyId}`, { params });
    return data;
  },

  async monthlyRevenue(params: { months?: number } = {}): Promise<MonthlyRevenuePoint[]> {
    const { data } = await client.get<MonthlyRevenuePoint[]>('/stats/monthly-revenue', { params });
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
};
