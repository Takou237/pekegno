import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CalendarDays,
  Users,
  DollarSign,
  TrendingUp,
  UserCheck,
  Clock,
  GraduationCap,
  Percent,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { client } from '@/api/client';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/Alert';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { formatCurrency, formatNumber } from '@/utils/number';

interface DepartmentLayoutContext {
  department?: { id: string; agency_id?: string } | null;
  departmentId?: string;
  agencyId?: string;
}

interface TrainingReportRow {
  id: string;
  code: string;
  name: string;
  mode: 'online' | 'in_person' | 'mixed';
  category: string | null;
  agency: string;
  price: number;
  report: {
    sessions_count: number;
    sessions_planned: number;
    sessions_completed: number;
    enrollments_total: number;
    enrollments_enrolled: number;
    enrollments_completed: number;
    attendance_count: number;
    attendance_rate: number;
    potential_revenue: number;
  };
}

interface TrainingReportResponse {
  data: TrainingReportRow[];
  summary: {
    courses: number;
    sessions: number;
    enrollments: number;
    potential_revenue: number;
  };
}

interface SessionRow {
  id: string;
  start_at: string;
  end_at: string | null;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  course?: { mode: 'online' | 'in_person' | 'mixed'; price?: number; name?: string } | null;
  trainer?: { first_name?: string; last_name?: string } | null;
  max_capacity?: number;
  enrollments_count?: number;
}

const MODE_COLORS: Record<string, string> = {
  in_person: '#6366f1',
  online: '#22c55e',
  mixed: '#f59e0b',
};

const STATUS_COLORS: Record<string, string> = {
  planned: '#3b82f6',
  ongoing: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

export default function AcademyReportsPage() {
  const { t } = useTranslation();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const [cards, setCards] = useState<StatCard[]>([]);
  const [reportRows, setReportRows] = useState<TrainingReportRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [formationEnrollments, setFormationEnrollments] = useState<
    { enrolled_at?: string | null; status?: string | null; course?: { name?: string; price?: number | null } | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    setCards([]);
    try {
      const reportPromise = client
        .get<TrainingReportResponse>('/reports/training')
        .then((r) => r.data);
      const sessionsPromise = (async () => {
        const all: SessionRow[] = [];
        let page = 1;
        let last = 1;
        do {
          const res = await client.get<{ data: SessionRow[]; meta: { last_page: number } }>(
            '/training-sessions',
            { params: { agency_id: agencyId, per_page: 100, page } },
          );
          all.push(...res.data.data);
          last = res.data.meta.last_page;
          page += 1;
        } while (page <= last);
        return all;
      })();
      const invoicesPromise = (async () => {
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

        const received = rows.reduce(
          (s, inv) => s + parseFloat(inv.amount_paid || '0'),
          0,
        );
        const outstanding = rows.reduce(
          (s, inv) =>
            s +
            (inv.status === 'unpaid' || inv.status === 'partial'
              ? parseFloat(inv.total_amount || '0') - parseFloat(inv.amount_paid || '0')
              : 0),
          0,
        );
        return { received, outstanding };
      })();
      const trainersPromise = client
        .get<{ meta?: { total?: number } }>('/trainers', { params: { agency_id: agencyId } })
        .then((r) => r.data.meta?.total ?? 0);
      const enrollmentsPromise = (async () => {
        const all: {
          enrolled_at?: string | null;
          status?: string | null;
          course?: { name?: string; price?: number | null } | null;
        }[] = [];
        const first = await client.get<{
          total?: number;
          last_page: number;
          data: typeof all;
        }>('/formation-enrollments', { params: { agency_id: agencyId, per_page: 100, page: 1 } });
        const last = first.data.last_page ?? 1;
        all.push(...first.data.data);
        for (let page = 2; page <= last; page += 1) {
          const res = await client.get<{ data: typeof all }>('/formation-enrollments', {
            params: { agency_id: agencyId, per_page: 100, page },
          });
          all.push(...res.data.data);
        }
        return all;
      })();

      const [report, sessionList, { received, outstanding }, trainersTotal, enrollments] =
        await Promise.all([
          reportPromise,
          sessionsPromise,
          invoicesPromise,
          trainersPromise,
          enrollmentsPromise,
        ]);

      setReportRows(report.data);
      setSessions(sessionList);
      setFormationEnrollments(enrollments);

      const attendanceTotal = report.data.reduce((sum, r) => sum + r.report.enrollments_enrolled, 0);
      const attendancePresent = report.data.reduce((sum, r) => sum + r.report.attendance_count, 0);
      const avgAttendance =
        attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;

      const capacitySessions = sessionList.filter((s) => s.max_capacity && s.max_capacity > 0);
      const avgFill =
        capacitySessions.length > 0
          ? Math.round(
              capacitySessions.reduce(
                (sum, s) => sum + (s.enrollments_count ?? 0) / s.max_capacity!,
                0,
              ) / capacitySessions.length * 100,
            )
          : 0;

      setCards([
        {
          label: t('reports.totalFormations'),
          value: report.summary.courses,
          icon: BookOpen,
          color: 'bg-blue-500',
        },
        {
          label: t('reports.totalSessions'),
          value: report.summary.sessions,
          icon: CalendarDays,
          color: 'bg-purple-500',
        },
        {
          label: t('reports.totalEnrollments'),
          value: enrollments.length,
          icon: Users,
          color: 'bg-green-500',
        },
        {
          label: t('reports.avgAttendanceRate'),
          value: `${avgAttendance}%`,
          icon: UserCheck,
          color: 'bg-cyan-500',
        },
        {
          label: t('reports.receivedRevenue'),
          value: formatCurrency(received),
          icon: DollarSign,
          color: 'bg-amber-500',
        },
        {
          label: t('reports.outstanding'),
          value: formatCurrency(outstanding),
          icon: TrendingUp,
          color: 'bg-red-500',
        },
        {
          label: t('reports.trainers'),
          value: trainersTotal,
          icon: GraduationCap,
          color: 'bg-indigo-500',
        },
        {
          label: t('reports.avgFillRate'),
          value: `${avgFill}%`,
          icon: Percent,
          color: 'bg-teal-500',
        },
      ]);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('common.error')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const e of formationEnrollments) {
      if (!e.enrolled_at) continue;
      const m = new Date(e.enrolled_at);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({
        month: new Date(`${k}-01`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        inscriptions: v,
      }));
  }, [formationEnrollments]);

  const modeBreakdown = useMemo(() => {
    const counts: Record<string, number> = { in_person: 0, online: 0, mixed: 0 };
    for (const s of sessions) {
      const mode = s.course?.mode;
      if (mode) counts[mode] += 1;
    }
    return Object.entries(counts).map(([key, value]) => ({
      name: t(`academy.mode${key === 'in_person' ? 'InPerson' : key === 'online' ? 'Online' : 'Mixed'}`),
      value,
      color: MODE_COLORS[key],
    }));
  }, [sessions, t]);

  const topCourses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of formationEnrollments) {
      const name = e.course?.name ?? '—';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, inscriptions]) => ({ name, inscriptions }))
      .sort((a, b) => b.inscriptions - a.inscriptions)
      .slice(0, 5);
  }, [formationEnrollments]);

  const sessionsByStatus = useMemo(() => {
    const counts: Record<string, number> = { planned: 0, ongoing: 0, completed: 0, cancelled: 0 };
    for (const s of sessions) counts[s.status] += 1;
    return Object.entries(counts).map(([key, value]) => ({
      name: t(`academy.status${key[0].toUpperCase()}${key.slice(1)}`),
      value,
      color: STATUS_COLORS[key],
    }));
  }, [sessions, t]);

  const revenueByCourse = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of formationEnrollments) {
      const name = e.course?.name ?? '—';
      const price = Number(e.course?.price ?? 0);
      totals.set(name, (totals.get(name) ?? 0) + price);
    }
    return Array.from(totals.entries())
      .map(([name, revenu]) => ({ name, revenu: Math.round(revenu) }))
      .sort((a, b) => b.revenu - a.revenu)
      .slice(0, 5);
  }, [formationEnrollments]);

  const attendanceByCourse = useMemo(() => {
    return [...reportRows]
      .map((r) => ({
        name: r.name,
        rate: r.report.attendance_rate,
        enrolled: r.report.enrollments_enrolled,
      }))
      .filter((r) => r.enrolled > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 6);
  }, [reportRows]);

  const upcomingSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter((s) => s.status === 'planned' && s.start_at && new Date(s.start_at) >= now)
      .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
      .slice(0, 6);
  }, [sessions]);

  if (loadError && cards.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.reports')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.subtitle')}</p>
        </div>
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.reports')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.subtitle')}</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {isLoading ? (
        <SkeletonDashboard />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.color} text-white`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Inscriptions par mois */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.trendTitle')}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="inscriptions"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Répartition par mode */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.modeBreakdown')}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={modeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {modeBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex justify-center gap-4">
                {modeBreakdown.map((m) => (
                  <span key={m.name} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    {m.name} ({formatNumber(m.value)})
                  </span>
                ))}
              </div>
            </div>

            {/* Top formations */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.topCourses')}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topCourses} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    width={120}
                  />
                  <Tooltip />
                  <Bar dataKey="inscriptions" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sessions par statut */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.sessionsByStatus')}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sessionsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name={t('reports.totalSessions')} radius={[4, 4, 0, 0]}>
                    {sessionsByStatus.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* CA potentiel par formation */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.revenueByCourse')}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByCourse} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    width={120}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="revenu" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Taux de présence par formation */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.attendanceByCourse')}
              </h2>
              {attendanceByCourse.length === 0 ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('reports.noAttendanceData')}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {attendanceByCourse.map((a) => (
                    <div key={a.name}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-gray-600 dark:text-gray-300">{a.name}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{a.rate}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-2 rounded-full bg-cyan-500"
                          style={{ width: `${Math.min(100, a.rate)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prochaines sessions */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('reports.upcomingSessions')}
            </h2>
            {upcomingSessions.length === 0 ? (
              <p className="flex h-20 items-center justify-center text-sm text-gray-400">
                {t('reports.noUpcomingSessions')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {upcomingSessions.map((s) => {
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
