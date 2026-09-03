import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  DollarSign,
  GraduationCap,
  Percent,
  TrendingUp,
  UserCheck,
  Users,
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
import { useTranslation } from 'react-i18next';
import { statsApi } from '@/api/stats.api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { useOrgContext } from '@/context/OrgContext';
import { formatCurrency, formatNumber } from '@/utils/number';
import type { TrainingGroupStats } from '@/types/stats';
import type { ReactNode } from 'react';

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

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function AcademyDashboardPage() {
  const { t } = useTranslation();
  const { countryId: routeCountryId } = useParams<{ countryId?: string }>();
  const { countries } = useOrgContext();
  const [training, setTraining] = useState<TrainingGroupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCountryId, setFilterCountryId] = useState<string>(routeCountryId ?? '');
  const [filterAgencyId, setFilterAgencyId] = useState<string>('');

  const scopedCountryId = routeCountryId ?? filterCountryId;

  const filteredAgencies = useMemo(() => {
    if (!scopedCountryId) return [];
    const country = countries.find((c) => c.id === scopedCountryId);
    return country?.agencies ?? [];
  }, [scopedCountryId, countries]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    statsApi
      .trainingGroup({
        countryId: scopedCountryId || undefined,
        agencyId: filterAgencyId || undefined,
      })
      .then((res) => {
        if (active) setTraining(res.training);
      })
      .catch(() => {
        if (active) setTraining(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [scopedCountryId, filterAgencyId]);

  const modeBreakdown = useMemo(() => {
    if (!training) return [];
    return training.mode_breakdown.map((m) => ({
      name: t(`reports.mode_${m.mode}`),
      value: m.value,
      color: MODE_COLORS[m.mode] ?? '#94a3b8',
    }));
  }, [training, t]);

  const sessionsByStatus = useMemo(() => {
    if (!training) return [];
    return training.sessions_by_status.map((s) => ({
      name: t(`reports.status_${s.status}`),
      value: s.value,
      color: STATUS_COLORS[s.status] ?? '#94a3b8',
    }));
  }, [training, t]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-brand-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('nav.academy')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!routeCountryId && (
            <select
              value={filterCountryId}
              onChange={(e) => {
                setFilterCountryId(e.target.value);
                setFilterAgencyId('');
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">{t('dashboard.allCountries')}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterAgencyId}
            onChange={(e) => setFilterAgencyId(e.target.value)}
            disabled={!scopedCountryId}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">{t('dashboard.allAgencies')}</option>
            {filteredAgencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {training && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('reports.totalFormations')}
              value={String(training.summary.courses)}
              icon={<BookOpen className="h-5 w-5" />}
              tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            />
            <StatCard
              label={t('reports.totalSessions')}
              value={String(training.summary.sessions)}
              icon={<CalendarDays className="h-5 w-5" />}
              tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
            />
            <StatCard
              label={t('reports.totalEnrollments')}
              value={String(training.summary.enrollments)}
              icon={<Users className="h-5 w-5" />}
              tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
            />
            <StatCard
              label={t('reports.avgAttendanceRate')}
              value={`${training.avg_attendance}%`}
              icon={<UserCheck className="h-5 w-5" />}
              tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
            />
            <StatCard
              label={t('reports.receivedRevenue')}
              value={formatCurrency(training.received)}
              icon={<DollarSign className="h-5 w-5" />}
              tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            />
            <StatCard
              label={t('reports.outstanding')}
              value={formatCurrency(training.outstanding)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
            />
            <StatCard
              label={t('reports.trainers')}
              value={String(training.trainers)}
              icon={<GraduationCap className="h-5 w-5" />}
              tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            />
            <StatCard
              label={t('reports.avgFillRate')}
              value={`${training.avg_fill_rate}%`}
              icon={<Percent className="h-5 w-5" />}
              tone="bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.trendTitle')}
              </h2>
              {training.monthly_trend.length === 0 ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={training.monthly_trend}>
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
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.modeBreakdown')}
              </h2>
              {modeBreakdown.every((m) => m.value === 0) ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <>
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
                      <span
                        key={m.name}
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.name} ({formatNumber(m.value)})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.topCourses')}
              </h2>
              {training.top_courses.length === 0 ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={training.top_courses} layout="vertical" margin={{ left: 20 }}>
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
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.sessionsByStatus')}
              </h2>
              {sessionsByStatus.every((s) => s.value === 0) ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('dashboard.noData')}
                </p>
              ) : (
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
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.revenueByCourse')}
              </h2>
              {training.revenue_by_course.length === 0 ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={training.revenue_by_course} layout="vertical" margin={{ left: 20 }}>
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
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('reports.attendanceByCourse')}
              </h2>
              {training.attendance_by_course.length === 0 ? (
                <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {training.attendance_by_course.map((a) => (
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
        </>
      )}
    </div>
  );
}
