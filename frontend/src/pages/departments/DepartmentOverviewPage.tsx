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
  UserCheck,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { client } from '@/api/client';
import { invoicesApi } from '@/api/invoices.api';
import { formatCurrency } from '@/utils/number';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';

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

interface OverviewCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  to?: string;
  color: string;
  bg: string;
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
    isLoading: boolean;
  } | null>(null);

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
          data: { total_amount: string; amount_paid: string; status?: string }[];
          last_page: number;
        };
        rows.push(...pag.data);
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
    setAcademy({
      summary,
      avgAttendance: avg,
      outstanding,
      received,
      learnersCount,
      enrollmentsCount,
      upcoming,
      isLoading: false,
    });
  }, [isAcademy, agencyId]);

  useEffect(() => {
    if (isAcademy && agencyId) {
      setAcademy(null);
      fetchAcademy();
    }
  }, [isAcademy, agencyId, fetchAcademy]);

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
        icon: TrendingUp,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-500/10',
      },
    ];
  }, [academy, t]);

  if (!department) {
    return <p className="text-sm text-error-500">{t('departments.empty')}</p>;
  }

  const agencyCard: OverviewCard = {
    label: t('departments.agency'),
    value: department.agency?.name ?? '—',
    icon: Building2,
    to: department.agency ? `/agencies/${department.agency_id}` : undefined,
    color: 'text-brand-600 dark:text-brand-400',
    bg: 'bg-brand-50 dark:bg-brand-500/10',
  };

  const chiefCard: OverviewCard = {
    label: t('departments.chiefOfDepartment'),
    value: department.department_chief?.name ?? '—',
    icon: ShieldCheck,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  };

  const effectifCard: OverviewCard = {
    label: t('departments.colCount'),
    value: usersCount ?? department.user_count ?? 0,
    icon: Users,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
  };

  const cards: OverviewCard[] = isAcademy
    ? [...kpis, agencyCard, chiefCard]
    : [effectifCard, agencyCard, chiefCard];

  return (
    <div className="flex flex-col gap-6">
      {isAcademy && academy?.isLoading ? (
        <SkeletonDashboard />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, to, color, bg }) =>
            to ? (
              <Link
                key={label}
                to={to}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              </Link>
            ) : (
              <div
                key={label}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                </div>
              </div>
            )
          )}
        </div>
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

      {isAcademy && academy && !academy.isLoading && academy.upcoming.length > 0 && (
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
    </div>
  );
}
