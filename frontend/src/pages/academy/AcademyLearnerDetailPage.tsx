import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  BookOpen,
  Wallet,
  Clock,
  UserCheck,
  BadgeCheck,
  Mail,
  Phone,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type LearnerEnrollmentItem, type LearnerStats } from '@/api/academy.api';
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

function EnrollmentTable({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  items: LearnerEnrollmentItem[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();

  function statusBadge(status: LearnerEnrollmentItem['status']) {
    if (status === 'completed') return <Badge variant="success">{t('academy.statusCompleted')}</Badge>;
    if (status === 'cancelled') return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
    return <Badge variant="brand">{t('academy.statusEnrolled')}</Badge>;
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                <th className="pb-2 pr-4 font-medium">{t('nav.trainers')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                <th className="pb-2 font-medium">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                    {item.course?.name ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {item.trainer ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {item.start_at
                      ? new Date(item.start_at).toLocaleString(currentLocale(), {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="py-2.5">{statusBadge(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AcademyLearnerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { learnerId } = useParams<{ learnerId: string }>();
  const [data, setData] = useState<LearnerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!learnerId) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    academyApi
      .learnerStats(learnerId)
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
  }, [learnerId, t]);

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
          {t('nav.learners')}
        </button>
        <p className="text-sm text-error-500">{loadError ?? t('academy.loadFailed')}</p>
      </div>
    );
  }

  const { learner, stats } = data;
  const fullName =
    [learner.first_name, learner.last_name].filter(Boolean).join(' ') || learner.email;
  const initials =
    [learner.first_name, learner.last_name]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || '?';

  const statusBars = [
    { key: 'enrolled' as const, label: t('academy.statusEnrolled'), color: 'bg-brand-500' },
    { key: 'completed' as const, label: t('academy.statusCompleted'), color: 'bg-success-500' },
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
        {t('nav.learners')}
      </button>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-50 text-lg font-semibold text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
              {learner.client_number && (
                <Badge variant="neutral">{learner.client_number}</Badge>
              )}
              {learner.is_active ? (
                <Badge variant="success">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t('common.active')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('common.inactive')}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {learner.email}
              </span>
              {learner.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {learner.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('academy.enrollmentsTotal')}
          value={stats.enrollments_total}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('academy.coursesTaken')}
          value={stats.courses_unique}
          icon={<BookOpen className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('academy.sessionsUpcoming')}
          value={stats.sessions_upcoming}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('academy.totalInvested')}
          value={formatCurrency(stats.total_invested)}
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
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('academy.enrollmentsCompleted')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.enrollments_by_status.completed}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <UserCheck className="h-3.5 w-3.5" />
              {t('academy.attendanceCount')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.attendance_count}
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
              <Clock className="h-3.5 w-3.5" />
              {t('academy.hoursCompleted')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.hours_completed} {t('academy.hours')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {statusBars.map(({ key, label, color }) => {
            const count = stats.enrollments_by_status[key] ?? 0;
            const percent =
              stats.enrollments_total > 0 ? Math.round((count / stats.enrollments_total) * 100) : 0;
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

      <EnrollmentTable
        title={t('academy.upcomingSessions')}
        icon={<CalendarClock className="h-4 w-4" />}
        items={data.upcoming_sessions}
        emptyLabel={t('academy.noUpcomingSessions')}
      />

      <EnrollmentTable
        title={t('academy.recentEnrollments')}
        icon={<CalendarDays className="h-4 w-4" />}
        items={data.recent_enrollments}
        emptyLabel={t('academy.noEnrollments')}
      />
    </div>
  );
}
