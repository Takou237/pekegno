import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  ShieldCheck,
  Building2,
  Calendar,
  BookOpen,
  CalendarDays,
  CalendarCheck,
  UserCheck,
  TrendingUp,
  Clock,
  Trophy,
  Receipt,
  ArrowRight,
  Package,
  Settings,
  FileSignature,
  HandCoins,
  CalendarClock,
  GraduationCap,
  BarChart3,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { client } from '@/api/client';
import { invoicesApi, type InvoiceIndexResponse } from '@/api/invoices.api';
import { statsApi } from '@/api/stats.api';
import { formatCurrency } from '@/utils/number';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { MonthlyRevenueChart } from '@/components/charts/MonthlyRevenueChart';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';
import type { Invoice, InvoiceStatus } from '@/types/invoice';
import type { AgencyStats, MonthlyRevenuePoint } from '@/types/stats';

interface DepartmentLayoutContext {
  department: Department | null;
  departmentId?: string;
  agencyId?: string;
  refreshDepartment?: () => void;
}

interface OverviewSession {
  id: string;
  start_at: string;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  course?: { name?: string; mode?: string } | null;
  trainer?: { first_name?: string; last_name?: string } | null;
  max_capacity?: number;
  enrollments_count?: number;
}

interface TopCourse {
  id: string;
  name: string;
  sessions_count: number;
  formation_enrollments_count: number;
}

interface TrainingReportResponse {
  data: Array<{
    report: {
      sessions_count: number;
      enrollments_total: number;
      enrollments_enrolled: number;
      attendance_count: number;
    };
  }>;
  summary: { courses: number; sessions: number; enrollments: number; potential_revenue: number };
}

interface BusinessOverview {
  stats: AgencyStats | null;
  monthly: MonthlyRevenuePoint[];
  recentInvoices: Invoice[];
  clientsCount: number;
  commercialsCount: number;
}

interface OverviewCard {
  label: string;
  value: string | number;
  icon: LucideIcon;
  to?: string;
  color: string;
  bg: string;
}

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  if (status === 'paid') return <Badge variant="success">{t('invoices.statusPaid')}</Badge>;
  if (status === 'partial') return <Badge variant="warning">{t('invoices.statusPartial')}</Badge>;
  if (status === 'cancelled') return <Badge variant="error">{t('invoices.statusCancelled')}</Badge>;
  return <Badge variant="error">{t('invoices.statusUnpaid')}</Badge>;
}

function RecentInvoicesCard({ invoices, viewAllTo }: { invoices: Invoice[]; viewAllTo: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('dashboard.recentInvoices')}
        </h2>
        <Link
          to={viewAllTo}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {t('agencies.overviewViewAll')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">{t('invoices.empty')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="pb-2 pr-4 font-medium">{t('invoices.colNumber')}</th>
                <th className="pb-2 pr-4 font-medium">{t('invoices.colClient')}</th>
                <th className="pb-2 pr-4 font-medium">{t('invoices.colDate')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('invoices.colTotal')}</th>
                <th className="pb-2 text-right font-medium">{t('invoices.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{inv.number}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {inv.client_label ?? inv.client?.client_number ?? inv.client_name ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {new Date(inv.invoice_date).toLocaleDateString(currentLocale())}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-gray-800 dark:text-gray-100">
                    {formatCurrency(inv.total_amount)}
                  </td>
                  <td className="py-2.5 text-right">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('departments.quickActions')}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map(({ label, to, icon: Icon, color, bg }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col items-center gap-2 rounded-xl border border-gray-100 p-3 text-center transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:hover:border-brand-500/40"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg} ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DepartmentOverviewPage() {
  const { t } = useTranslation();
  const { department, departmentId, agencyId } = useOutletContext<DepartmentLayoutContext>();
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [academy, setAcademy] = useState<{
    summary: TrainingReportResponse['summary'];
    avgAttendance: number;
    outstanding: number;
    received: number;
    learnersCount: number;
    enrollmentsCount: number;
    upcoming: OverviewSession[];
    recentInvoices: Invoice[];
    monthly: MonthlyRevenuePoint[];
    topCourses: TopCourse[];
    isLoading: boolean;
  } | null>(null);
  const [business, setBusiness] = useState<BusinessOverview | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    client
      .get(`/departments/${departmentId}/users`)
      .then(({ data }) => {
        setUsersCount((data.data ?? data).length);
      })
      .catch(() => setUsersCount(0));
  }, [departmentId]);

  const isAcademy = department?.type === 'academy';

  const fetchAcademy = useCallback(async () => {
    if (!isAcademy || !agencyId) return;
    let summary: TrainingReportResponse['summary'] = {
      courses: 0,
      sessions: 0,
      enrollments: 0,
      potential_revenue: 0,
    };
    let avg = 0;
    try {
      const { data } = await client.get<TrainingReportResponse>('/reports/training');
      summary = data.summary;
      const total = data.data.reduce((s, r) => s + r.report.enrollments_enrolled, 0);
      const present = data.data.reduce((s, r) => s + r.report.attendance_count, 0);
      avg = total > 0 ? Math.round((present / total) * 100) : 0;
    } catch {
      /* ignore */
    }
    let outstanding = 0;
    let received = 0;
    let recentInvoices: Invoice[] = [];
    try {
      const rows: { total_amount: string; amount_paid: string; status?: string }[] = [];
      let page = 1;
      let last = 1;
      do {
        const res = await invoicesApi.list({
          agency_id: agencyId,
          from_enrollments: true,
          per_page: 100,
          page,
        });
        const pag = res.invoices as unknown as {
          data: Invoice[];
          last_page: number;
        };
        if (page === 1) recentInvoices = pag.data.slice(0, 5);
        rows.push(...(pag.data as { total_amount: string; amount_paid: string; status?: string }[]));
        last = pag.last_page;
        page += 1;
      } while (page <= last);
      received = rows.reduce((s, inv) => s + parseFloat(inv.amount_paid || '0'), 0);
      outstanding = rows.reduce(
        (s, inv) =>
          s +
          (inv.status === 'unpaid' || inv.status === 'partial'
            ? parseFloat(inv.total_amount || '0') - parseFloat(inv.amount_paid || '0')
            : 0),
        0,
      );
    } catch {
      /* ignore */
    }
    const upcoming: OverviewSession[] = [];
    try {
      const now = new Date();
      const all: OverviewSession[] = [];
      const res = await client.get<{ data: OverviewSession[]; meta: { last_page: number } }>(
        '/training-sessions',
        { params: { agency_id: agencyId, per_page: 100, page: 1 } },
      );
      all.push(...res.data.data);
      upcoming.push(
        ...all
          .filter((s) => s.status === 'planned' && s.start_at && new Date(s.start_at) >= now)
          .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
          .slice(0, 5),
      );
    } catch {
      /* ignore */
    }
    let learnersCount = 0;
    try {
      const res = await client.get<{ meta?: { total?: number } }>('/learners', {
        params: { agency_id: agencyId, per_page: 1 },
      });
      learnersCount = res.data.meta?.total ?? 0;
    } catch {
      /* ignore */
    }
    let enrollmentsCount = 0;
    try {
      const res = await client.get<{ total?: number }>('/formation-enrollments', {
        params: { agency_id: agencyId, per_page: 1 },
      });
      enrollmentsCount = res.data.total ?? 0;
    } catch {
      /* ignore */
    }
    let monthly: MonthlyRevenuePoint[] = [];
    try {
      monthly = await statsApi.monthlyRevenue({ months: 12, agencyId });
    } catch {
      /* ignore */
    }
    let topCourses: TopCourse[] = [];
    try {
      const res = await client.get<{ data: TopCourse[] }>('/courses', {
        params: { agency_id: agencyId, per_page: 100 },
      });
      topCourses = res.data.data
        .sort((a, b) => (b.formation_enrollments_count ?? 0) - (a.formation_enrollments_count ?? 0))
        .slice(0, 5);
    } catch {
      /* ignore */
    }
    setAcademy((prev) => ({
      ...(prev ?? { summary, avgAttendance: 0, outstanding: 0, received: 0, learnersCount: 0, enrollmentsCount: 0, upcoming: [], recentInvoices: [], monthly: [], topCourses: [], isLoading: false }),
      summary,
      avgAttendance: avg,
      outstanding,
      received,
      learnersCount,
      enrollmentsCount,
      upcoming,
      recentInvoices,
      monthly,
      topCourses,
      isLoading: false,
    }));
  }, [isAcademy, agencyId]);

  const fetchBusiness = useCallback(async () => {
    if (isAcademy || !agencyId) return;
    const [statsRes, monthlyRes, invoicesRes, clientsRes, commercialsRes] = await Promise.allSettled([
      statsApi.agency(agencyId),
      statsApi.monthlyRevenue({ months: 12, agencyId }),
      invoicesApi.list({ agency_id: agencyId, per_page: 5 }),
      client.get<{ meta?: { total?: number } }>('/clients', {
        params: { agency_id: agencyId, per_page: 1 },
      }),
      client.get<{ meta?: { total?: number } }>('/commercials', {
        params: { agency_id: agencyId, per_page: 1 },
      }),
    ]);
    setBusiness({
      stats:
        statsRes.status === 'fulfilled' ? (statsRes.value as AgencyStats) : null,
      monthly:
        monthlyRes.status === 'fulfilled' ? (monthlyRes.value as MonthlyRevenuePoint[]) : [],
      recentInvoices:
        invoicesRes.status === 'fulfilled'
          ? (invoicesRes.value as InvoiceIndexResponse).invoices.data ?? []
          : [],
      clientsCount:
        clientsRes.status === 'fulfilled' ? clientsRes.value.data.meta?.total ?? 0 : 0,
      commercialsCount:
        commercialsRes.status === 'fulfilled' ? commercialsRes.value.data.meta?.total ?? 0 : 0,
    });
  }, [isAcademy, agencyId]);

  useEffect(() => {
    if (isAcademy && agencyId) {
      setAcademy(null);
      fetchAcademy();
    }
  }, [isAcademy, agencyId, fetchAcademy]);

  useEffect(() => {
    if (!isAcademy && agencyId) {
      setBusiness(null);
      fetchBusiness();
    }
  }, [isAcademy, agencyId, fetchBusiness]);

  const kpis = useMemo<OverviewCard[]>(() => {
    if (!academy || academy.isLoading) return [];
    return [
      {
        label: t('departments.colCount'),
        value: academy.learnersCount,
        icon: Users,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-500/10',
      },
      {
        label: t('reports.totalFormations'),
        value: academy.summary.courses,
        icon: BookOpen,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
      },
      {
        label: t('reports.totalSessions'),
        value: academy.summary.sessions,
        icon: CalendarDays,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      },
      {
        label: t('reports.totalEnrollments'),
        value: academy.enrollmentsCount,
        icon: UserCheck,
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-500/10',
      },
      {
        label: t('reports.avgAttendanceRate'),
        value: `${academy.avgAttendance}%`,
        icon: UserCheck,
        color: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      },
      {
        label: t('reports.receivedRevenue'),
        value: formatCurrency(academy.received),
        icon: TrendingUp,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
      },
      {
        label: t('reports.outstanding'),
        value: formatCurrency(academy.outstanding),
        icon: Clock,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-500/10',
      },
    ];
  }, [academy, t]);

  const agencyCard = useMemo<OverviewCard>(
    () => ({
      label: t('departments.agency'),
      value: department?.agency?.name ?? '—',
      icon: Building2,
      to: department?.agency ? `/agencies/${department.agency_id}` : undefined,
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
    }),
    [department, t],
  );

  const chiefCard = useMemo<OverviewCard>(
    () => ({
      label: t('departments.chiefOfDepartment'),
      value: department?.department_chief?.name ?? '—',
      icon: ShieldCheck,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    }),
    [department, t],
  );

  const effectifCard = useMemo<OverviewCard>(
    () => ({
      label: t('departments.colCount'),
      value: usersCount ?? department?.user_count ?? 0,
      icon: Users,
      to: departmentId ? `/departments/${departmentId}/team` : undefined,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
    }),
    [usersCount, department, departmentId, t],
  );

  const businessKpis = useMemo<OverviewCard[]>(() => {
    if (!business) return [];
    const stats = business.stats;
    return [
      effectifCard,
      {
        label: t('dashboard.revenue'),
        value: formatCurrency(stats?.revenue ?? 0),
        icon: TrendingUp,
        to: departmentId ? `/departments/${departmentId}/invoices` : undefined,
        color: 'text-brand-600 dark:text-brand-400',
        bg: 'bg-brand-50 dark:bg-brand-500/10',
      },
      {
        label: t('dashboard.outstanding'),
        value: formatCurrency(stats?.outstanding ?? 0),
        icon: Clock,
        to: departmentId ? `/departments/${departmentId}/invoices` : undefined,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
      },
      {
        label: t('dashboard.sales'),
        value: stats?.sales_count ?? 0,
        icon: Receipt,
        to: departmentId ? `/departments/${departmentId}/invoices` : undefined,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      },
    ];
  }, [business, effectifCard, departmentId, t]);

  const businessInfoCards = useMemo<OverviewCard[]>(
    () => [
      {
        label: t('dashboard.clients'),
        value: business?.clientsCount ?? 0,
        icon: HandCoins,
        to: departmentId ? `/departments/${departmentId}/clients` : undefined,
        color: 'text-sky-600 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-500/10',
      },
      {
        label: t('dashboard.commercials'),
        value: business?.commercialsCount ?? 0,
        icon: Trophy,
        to: '/commercials',
        color: 'text-fuchsia-600 dark:text-fuchsia-400',
        bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
      },
      agencyCard,
      chiefCard,
    ],
    [business, agencyCard, chiefCard, departmentId, t],
  );

  const academyQuickActions = useMemo<QuickAction[]>(() => {
    if (!departmentId) return [];
    const base = `/departments/${departmentId}`;
    return [
      {
        label: t('nav.learners'),
        to: `${base}/learners`,
        icon: GraduationCap,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-500/10',
      },
      {
        label: t('nav.courses'),
        to: `${base}/courses`,
        icon: BookOpen,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
      },
      {
        label: t('nav.sessions'),
        to: `${base}/sessions`,
        icon: CalendarDays,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      },
      {
        label: t('nav.planning'),
        to: `${base}/planning`,
        icon: CalendarCheck,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      },
      {
        label: t('nav.trainers'),
        to: `${base}/trainers`,
        icon: UserCheck,
        color: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      },
      {
        label: t('nav.presences'),
        to: `${base}/presences`,
        icon: ClipboardList,
        color: 'text-sky-600 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-500/10',
      },
      {
        label: t('nav.invoices'),
        to: `${base}/invoices`,
        icon: Receipt,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
      },
      {
        label: t('nav.reports'),
        to: `${base}/reports`,
        icon: BarChart3,
        color: 'text-fuchsia-600 dark:text-fuchsia-400',
        bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
      },
    ];
  }, [departmentId, t]);

  const businessQuickActions = useMemo<QuickAction[]>(() => {
    if (!departmentId) return [];
    const base = `/departments/${departmentId}`;
    return [
      {
        label: t('nav.teams'),
        to: `${base}/team`,
        icon: Users,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-500/10',
      },
      {
        label: t('nav.clients'),
        to: `${base}/clients`,
        icon: HandCoins,
        color: 'text-sky-600 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-500/10',
      },
      {
        label: t('contracts.title'),
        to: `${base}/contracts`,
        icon: FileSignature,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      },
      {
        label: t('nav.services'),
        to: `${base}/services`,
        icon: Package,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      },
      {
        label: t('renewals.title'),
        to: `${base}/renewals`,
        icon: CalendarClock,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
      },
      {
        label: t('nav.settings'),
        to: `${base}/settings`,
        icon: Settings,
        color: 'text-gray-600 dark:text-gray-300',
        bg: 'bg-gray-100 dark:bg-gray-800',
      },
    ];
  }, [departmentId, t]);

  if (!department) {
    return <p className="text-sm text-error-500">{t('departments.empty')}</p>;
  }

  const renderCard = ({ label, value, icon: Icon, to, color, bg }: OverviewCard) => {
    const inner = (
      <>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </>
    );
    const className =
      'flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900';
    if (to) {
      return (
        <Link key={label} to={to} className={`${className} transition-shadow hover:shadow-md`}>
          {inner}
        </Link>
      );
    }
    return (
      <div key={label} className={className}>
        {inner}
      </div>
    );
  };

  const recentInvoices = business?.recentInvoices ?? [];
  const topCommercials = business?.stats?.top_commercials ?? [];

  return (
    <div className="flex flex-col gap-6">
      {isAcademy ? (
        academy && !academy.isLoading ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.slice(0, 4).map(renderCard)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[...kpis.slice(4), agencyCard].map(renderCard)}
            </div>

            <MonthlyRevenueChart data={academy.monthly} />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <RecentInvoicesCard
                invoices={academy.recentInvoices}
                viewAllTo={`/departments/${departmentId}/invoices`}
              />
              <QuickActionsCard actions={academyQuickActions} />
            </div>

            {academy.topCourses.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t('reports.topCourses')}
                  </h2>
                  <Link
                    to={`/departments/${departmentId}/courses`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {t('agencies.overviewViewAll')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">{t('academy.courseName')}</th>
                        <th className="pb-2 pr-4 text-right font-medium">{t('reports.totalSessions')}</th>
                        <th className="pb-2 text-right font-medium">{t('reports.totalEnrollments')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {academy.topCourses.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{c.name}</td>
                          <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">
                            {c.sessions_count}
                          </td>
                          <td className="py-2.5 text-right font-medium text-gray-800 dark:text-gray-100">
                            {c.formation_enrollments_count ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {academy.upcoming.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('reports.upcomingSessions')}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {academy.upcoming.map((s) => {
                    const start = new Date(s.start_at);
                    const trainer = s.trainer
                      ? `${s.trainer.first_name ?? ''} ${s.trainer.last_name ?? ''}`.trim()
                      : '';
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {s.course?.name ?? '—'}
                        </p>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {start.toLocaleString(undefined, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {trainer && <span className="flex items-center gap-1.5">{trainer}</span>}
                          <span>
                            {t('academy.enrollmentsCount')} : {s.enrollments_count ?? 0}
                            {s.max_capacity ? ` / ${s.max_capacity}` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <SkeletonDashboard />
        )
      ) : business ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {businessKpis.map(renderCard)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {businessInfoCards.map(renderCard)}
          </div>

          <MonthlyRevenueChart data={business.monthly} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <RecentInvoicesCard
              invoices={recentInvoices}
              viewAllTo={`/departments/${departmentId}/invoices`}
            />
            <QuickActionsCard actions={businessQuickActions} />
          </div>

          {topCommercials.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t('dashboard.topCommercials')}
                </h2>
                <Link
                  to="/commercials"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {t('agencies.overviewViewAll')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">{t('dashboard.commercials')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('dashboard.salesCount')}</th>
                      <th className="pb-2 text-right font-medium">{t('dashboard.turnover')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {topCommercials.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{c.full_name}</td>
                        <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{c.sales_count}</td>
                        <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                          {formatCurrency(c.turnover)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <SkeletonDashboard />
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{department.name}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.description')}</dt>
            <dd className="mt-1 text-gray-800 dark:text-gray-100">
              {department.description ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.agency')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <Building2 className="h-4 w-4 text-gray-400" />
              {department.agency?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.chiefOfDepartment')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              {department.department_chief?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.createdAt')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(department.created_at).toLocaleDateString(currentLocale())}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}