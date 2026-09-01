import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  Clock,
  GraduationCap,
  Layers,
  MessageSquareText,
  Users,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { client } from '@/api/client';
import { academyApi, type Course, type TrainingSession } from '@/api/academy.api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';
import type { LearnerObservation } from '@/types/formation';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

interface Kpi {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
}

interface QuickLink {
  to: string;
  label: string;
  icon: LucideIcon;
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

interface OverviewData {
  courses: number;
  sessions: number;
  learners: number;
  avgAttendance: number;
  upcoming: TrainingSession[];
  topCourses: Course[];
  observations: LearnerObservation[];
  isLoading: boolean;
}

export default function AcademyFormationsOverviewPage() {
  const { t } = useTranslation();
  const { departmentId, agencyId } = useOutletContext<DepartmentLayoutContext>();
  const [data, setData] = useState<OverviewData | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!agencyId) return;

    const result: OverviewData = {
      courses: 0,
      sessions: 0,
      learners: 0,
      avgAttendance: 0,
      upcoming: [],
      topCourses: [],
      observations: [],
      isLoading: false,
    };

    try {
      const [coursesRes, sessionsRes, learnersRes, trainingRes, observationsRes] =
        await Promise.allSettled([
          academyApi.courses({ agency_id: agencyId, per_page: 100 }),
          academyApi.sessions({ agency_id: agencyId, per_page: 100 }),
          client.get<{ meta?: { total?: number } }>('/learners', {
            params: { agency_id: agencyId, per_page: 1 },
          }),
          client.get<TrainingReportResponse>('/reports/training', {
            params: { agency_id: agencyId },
          }),
          academyApi.learnerObservations({ agency_id: agencyId, per_page: 5 }),
        ]);

      if (coursesRes.status === 'fulfilled') {
        result.courses = coursesRes.value.meta.total ?? coursesRes.value.data.length;
        result.topCourses = coursesRes.value.data
          .slice()
          .sort(
            (a, b) =>
              (b.formation_enrollments_count ?? 0) - (a.formation_enrollments_count ?? 0),
          )
          .slice(0, 6);
      }

      if (sessionsRes.status === 'fulfilled') {
        const now = new Date();
        result.sessions = sessionsRes.value.meta.total ?? sessionsRes.value.data.length;
        result.upcoming = sessionsRes.value.data
          .filter((s) => s.status === 'planned' && s.start_at && new Date(s.start_at) >= now)
          .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
          .slice(0, 6);
      }

      if (learnersRes.status === 'fulfilled') {
        result.learners = learnersRes.value.data.meta?.total ?? 0;
      }

      if (trainingRes.status === 'fulfilled') {
        const summary = trainingRes.value.data.summary;
        result.courses = summary.courses;
        result.sessions = summary.sessions;
        const total = trainingRes.value.data.data.reduce(
          (s, r) => s + r.report.enrollments_enrolled,
          0,
        );
        const present = trainingRes.value.data.data.reduce(
          (s, r) => s + r.report.attendance_count,
          0,
        );
        result.avgAttendance = total > 0 ? Math.round((present / total) * 100) : 0;
      }

      if (observationsRes.status === 'fulfilled') {
        result.observations = observationsRes.value.data.slice(0, 5);
      }
    } catch {
      /* aperçu tolérant aux erreurs */
    }

    setData(result);
  }, [agencyId]);

  useEffect(() => {
    if (agencyId) {
      setData(null);
      fetchOverview();
    }
  }, [agencyId, fetchOverview]);

  const kpis = useMemo<Kpi[]>(() => {
    if (!data) return [];
    return [
      {
        label: t('reports.totalFormations'),
        value: data.courses,
        icon: BookOpen,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-500/10',
      },
      {
        label: t('reports.totalSessions'),
        value: data.sessions,
        icon: CalendarDays,
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      },
      {
        label: t('academy.overviewLearners'),
        value: data.learners,
        icon: Users,
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-500/10',
      },
      {
        label: t('reports.avgAttendanceRate'),
        value: `${data.avgAttendance}%`,
        icon: UserCheck,
        color: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      },
    ];
  }, [data, t]);

  const subNav = useMemo<QuickLink[]>(() => {
    if (!departmentId) return [];
    const base = `/departments/${departmentId}`;
    return [
      { to: `${base}/courses`, label: t('academy.overview'), icon: BookOpen },
      { to: `${base}/courses/list`, label: t('academy.catalog'), icon: Layers },
      { to: `${base}/sessions`, label: t('nav.sessions'), icon: CalendarDays },
      { to: `${base}/planning`, label: t('nav.planning'), icon: CalendarClock },
      { to: `${base}/learners`, label: t('nav.learners'), icon: Users },
      { to: `${base}/trainers`, label: t('nav.trainers'), icon: UserCheck },
      { to: `${base}/presences`, label: t('nav.presences'), icon: ClipboardList },
      { to: `${base}/reports`, label: t('nav.reports'), icon: GraduationCap },
    ];
  }, [departmentId, t]);

  if (!data) {
    return <SkeletonDashboard />;
  }

  const renderKpi = ({ label, value, icon: Icon, color, bg }: Kpi) => (
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
  );

  const sessionStatus = (status: TrainingSession['status']) => {
    switch (status) {
      case 'ongoing':
        return <Badge variant="warning">{t('academy.statusOngoing')}</Badge>;
      case 'completed':
        return <Badge variant="success">{t('academy.statusCompletedSession')}</Badge>;
      case 'cancelled':
        return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
      default:
        return <Badge variant="neutral">{t('academy.statusPlanned')}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sous-navigation — liens rapides */}
      <div className="flex flex-wrap gap-2">
        {subNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-brand-500/50'
              }`
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(renderKpi)}</div>

      {/* Prochaines sessions + apprenants par session */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('academy.upcomingSessions')}
          </h2>
          <Link
            to={`/departments/${departmentId}/sessions`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('agencies.overviewViewAll')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {data.upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">{t('academy.noUpcomingSessions')}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((session) => {
              const start = new Date(session.start_at);
              const trainer = session.trainer
                ? `${session.trainer.first_name ?? ''} ${session.trainer.last_name ?? ''}`.trim()
                : '';
              const capacity = session.max_capacity ?? null;
              const enrolled = session.enrollments_count ?? 0;
              const pct = capacity && capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {session.course?.name ?? '—'}
                    </p>
                    {sessionStatus(session.status)}
                  </div>
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
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        {t('academy.learnersPerSession')}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {enrolled}
                        {capacity ? ` / ${capacity}` : ''}
                      </span>
                    </div>
                    {capacity && capacity > 0 && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formations & modules */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('academy.coursesModules')}
          </h2>
          <Link
            to={`/departments/${departmentId}/courses/list`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('agencies.overviewViewAll')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {data.topCourses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">{t('academy.noCourses')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t('academy.courseName')}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t('nav.modules')}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t('reports.totalSessions')}</th>
                  <th className="pb-2 text-right font-medium">{t('reports.totalEnrollments')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.topCourses.map((course) => (
                  <tr key={course.id}>
                    <td className="py-2.5 pr-4">
                      <Link
                        to={`/departments/${departmentId}/courses/${course.id}/modules`}
                        className="font-medium text-gray-800 hover:text-brand-600 hover:underline dark:text-gray-100"
                      >
                        {course.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">
                      {course.modules_count ?? 0}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-300">
                      {course.sessions_count ?? 0}
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-800 dark:text-gray-100">
                      {course.formation_enrollments_count ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Observations récentes */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('academy.recentObservations')}
          </h2>
        </div>

        {data.observations.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">{t('academy.noRecentObservations')}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.observations.map((observation) => {
              const learnerName =
                observation.learner && (observation.learner.first_name || observation.learner.last_name)
                  ? `${observation.learner.first_name ?? ''} ${observation.learner.last_name ?? ''}`.trim()
                  : null;
              return (
                <div
                  key={observation.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                        <MessageSquareText className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                        {learnerName ?? t('academy.learner')}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {new Date(observation.created_at).toLocaleDateString(currentLocale())}
                    </span>
                  </div>
                  {observation.course?.name && (
                    <p className="mt-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
                      {observation.course.name}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {observation.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}