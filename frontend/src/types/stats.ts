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

export interface TopProduct {
  label: string;
  quantity: number;
  revenue: number;
  transactions: number;
}

export interface TopAgency {
  id: string;
  name: string;
  code: string;
  country: string;
  country_id?: string | null;
  revenue: number;
  invoices_count: number;
}

export interface CountryStat {
  id: string;
  name: string;
  code: string;
  currency_code: string;
  is_active: boolean;
  agencies_count: number;
  revenue: number;
  outstanding: number;
  invoices_count: number;
}

export interface GroupStats {
  period: { from: string; to: string };
  revenue: number;
  payments_total: number;
  expenses_total: number;
  net_cash: number;
  outstanding: number;
  invoices_total: number;
  invoices_paid: number;
  clients_total: number;
  new_clients: number;
  subscriptions_active: number;
  average_invoice_value: number;
  collection_rate: number;
  agencies_total: number;
  departments_total: number;
  users_total: number;
  countries: CountryStat[];
}

export interface TrainingGroupSummary {
  courses: number;
  sessions: number;
  enrollments: number;
  potential_revenue: number;
}

export interface TrainingMonthPoint {
  month: string;
  inscriptions: number;
}

export interface TrainingModeStat {
  mode: 'in_person' | 'online' | 'mixed';
  value: number;
}

export interface TrainingStatusStat {
  status: string;
  value: number;
}

export interface TrainingCourseStat {
  name: string;
  inscriptions: number;
  revenu?: number;
}

export interface TrainingAttendanceStat {
  name: string;
  rate: number;
  enrolled: number;
}

export interface TrainingUpcomingSession {
  id: string;
  course: string | null;
  trainer: string | null;
  start_at: string;
  enrollments_count: number;
  max_capacity: number | null;
}

export interface TrainingGroupStats {
  summary: TrainingGroupSummary;
  received: number;
  outstanding: number;
  trainers: number;
  avg_attendance: number;
  avg_fill_rate: number;
  monthly_trend: TrainingMonthPoint[];
  mode_breakdown: TrainingModeStat[];
  top_courses: TrainingCourseStat[];
  sessions_by_status: TrainingStatusStat[];
  revenue_by_course: TrainingCourseStat[];
  attendance_by_course: TrainingAttendanceStat[];
  upcoming: TrainingUpcomingSession[];
}

export interface ServiceGroupSummary {
  total: number;
  sold: number;
  seminars: number;
  invoices: number;
  revenue: number;
}

export interface ServiceMonthlyRevenue {
  month: string;
  revenue: number;
}

export interface ServiceTopStat {
  name: string;
  quantity: number;
  revenue: number;
  invoices: number;
}

export interface ServiceCategoryStat {
  category: string;
  revenue: number;
  count: number;
}

export interface ServiceGroupStats {
  summary: ServiceGroupSummary;
  monthly_revenue: ServiceMonthlyRevenue[];
  top_services: ServiceTopStat[];
  by_category: ServiceCategoryStat[];
}

export interface GroupReportStats {
  training: TrainingGroupStats;
  services: ServiceGroupStats;
}
