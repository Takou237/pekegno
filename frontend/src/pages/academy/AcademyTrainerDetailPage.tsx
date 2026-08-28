import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  GraduationCap,
  UserCog,
  Wallet,
  Clock,
  UserCheck,
  BadgeCheck,
  Mail,
  Phone,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type TrainerSessionItem, type TrainerStats } from '@/api/academy.api';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
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

function SessionTable({
  title,
  icon,
  sessions,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  sessions: TrainerSessionItem[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();

  function statusBadge(status: TrainerSessionItem['status']) {
    switch (status) {
      case 'ongoing':
        return <Badge variant="warning">{t('academy.statusOngoing')}</Badge>;
      case 'completed':
        return <Badge variant="success">{t('academy.statusCompletedSession')}</Badge>;
      case 'cancelled':
        return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
      default:
        return <Badge variant="brand">{t('academy.statusPlanned')}</Badge>;
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.location')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.enrollmentsCount')}</th>
                <th className="pb-2 font-medium">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                    {session.course?.name ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {new Date(session.start_at).toLocaleString(currentLocale(), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {session.location ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {session.enrollments_count}
                  </td>
                  <td className="py-2.5">{statusBadge(session.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AcademyTrainerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trainerId } = useParams<{ trainerId: string }>();
  const [data, setData] = useState<TrainerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!trainerId) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    academyApi
      .trainerStats(trainerId)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((error) => {
        if (active) setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trainerId, t]);

  if (isLoading) return <SkeletonDashboard />;

  if (loadError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('nav.trainers')}
        </button>
        <p className="text-sm text-error-500">{loadError ?? t('academy.loadFailed')}</p>
      </div>
    );
  }

  const { trainer, stats } = data;
  const fullName =
    [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email;
  const initials =
    [trainer.first_name, trainer.last_name]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || '?';

  const statusBars = [
    { key: 'planned' as const, label: t('academy.statusPlanned'), color: 'bg-brand-500' },
    { key: 'ongoing' as const, label: t('academy.statusOngoing'), color: 'bg-warning-500' },
    { key: 'completed' as const, label: t('academy.statusCompletedSession'), color: 'bg-success-500' },
    { key: 'cancelled' as const, label: t('academy.statusCancelled'), color: 'bg-error-500' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('nav.trainers')}
      </button>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-50 text-lg font-semibold text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
              {trainer.is_active ? (
                <Badge variant="success">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t('common.active')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('common.inactive')}</Badge>
              )}
              {trainer.has_account ? (
                <Badge variant="brand">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t('academy.hasAccount')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('academy.noAccount')}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {trainer.email}
              </span>
              {trainer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {trainer.phone}
                </span>
              )}
              {trainer.created_at && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t('academy.memberSince')}:{' '}
                  {new Date(trainer.created_at).toLocaleDateString(currentLocale(), { dateStyle: 'long' })}
                </span>
              )}
            </div>
            {trainer.bio && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{trainer.bio}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('nav.sessions')}
          value={stats.sessions_total}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('academy.sessionsUpcoming')}
          value={stats.sessions_upcoming}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('academy.learnersTrained')}
          value={stats.learners_unique}
          icon={<UserCog className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('academy.potentialRevenue')}
          value={formatCurrency(stats.potential_revenue)}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('academy.metricsTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <GraduationCap className="h-3.5 w-3.5" />
              {t('academy.enrollmentsTotal')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.enrollments_total}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('academy.completionRate')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.completion_rate}%
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <UserCheck className="h-3.5 w-3.5" />
              {t('academy.attendanceRate')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.attendance_rate}%
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {t('academy.hoursTaught')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.hours_taught} {t('academy.hours')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {statusBars.map(({ key, label, color }) => {
            const count = stats.sessions_by_status[key] ?? 0;
            const percent =
              stats.sessions_total > 0 ? Math.round((count / stats.sessions_total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-700 dark:text-gray-200">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <Layers className="h-4 w-4" />
          {t('academy.assignedModules')}
        </h2>
        {!data.assigned_modules || data.assigned_modules.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noAssignedModules')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.assigned_modules.map((module) => (
              <span
                key={module.id}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <span className="font-medium text-gray-800 dark:text-gray-100">{module.name}</span>
                {module.course && (
                  <span className="text-xs text-gray-400">
                    {module.course.name}
                    {module.course.code ? ` · ${module.course.code}` : ''}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <SessionTable
        title={t('academy.upcomingSessions')}
        icon={<CalendarClock className="h-4 w-4" />}
        sessions={data.upcoming_sessions}
        emptyLabel={t('academy.noUpcomingSessions')}
      />

      <SessionTable
        title={t('academy.recentSessions')}
        icon={<CalendarDays className="h-4 w-4" />}
        sessions={data.recent_sessions}
        emptyLabel={t('academy.noSessions')}
      />
    </div>
  );
}
