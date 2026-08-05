export interface DashboardStats {
  period: { from: string; to: string };
  revenue: number;
  payments_total: number;
  advances_total: number;
  outstanding: number;
  invoices_total: number;
  invoices_paid: number;
  clients_total: number;
  commercials_active: number;
  agencies_total: number;
  departments_total: number;
  users_total: number;
  top_commercials: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    points_balance: number;
    sales_count: number;
    revenue: number;
  }[];
}

export interface AgencyStats {
  agency: { id: string; name: string };
  period: { from: string; to: string };
  revenue: number;
  outstanding: number;
  sales_count: number;
  top_commercials: {
    id: string;
    full_name: string;
    turnover: number;
    sales_count: number;
  }[];
}

export interface MonthlyRevenuePoint {
  month: string;
  label: string;
  revenue: number;
  invoices: number;
}

export interface TopCommercial {
  id: string;
  full_name: string;
  agency: string | null;
  points_balance: number;
  turnover: number;
  sales_count: number;
}

export interface CategorySales {
  category: string;
  revenue: number;
  items: number;
}

export interface PaymentMethodStat {
  method: string;
  total: number;
  count: number;
}
