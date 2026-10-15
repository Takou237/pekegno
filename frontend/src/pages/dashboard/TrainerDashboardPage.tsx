import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarClock,
  GraduationCap,
  Users,
  BookOpen,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Learner, type TrainerSessionItem, type TrainerStats } from '@/api/academy.api';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { currentLocale } from '@/i18n';

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold sm:text-2xl text-gray-900 dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: TrainerSessionItem['status'] }) {
  const { t } = useTranslation();
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

function SessionTable({
  title,
  icon: Icon,
  sessions,
  emptyLabel,
}: {
  title: string;
  icon: LucideIcon;
  sessions: TrainerSessionItem[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4" />
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
                    {session.enrollments_count}
                  </td>
                  <td className="py-2.5">
                    <SessionStatusBadge status={session.status} />
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

export default function TrainerDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<TrainerStats | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    academyApi
      .myTrainerStats()
      .then(async (stats) => {
        if (!active) return;
        setData(stats);

        // Apprenants : on récupère ceux des formations assurées par le
        // formateur (modules assignés + sessions), via l'endpoint existant.
        const courseIds = new Set<string>();
        stats.assigned_modules.forEach((m) => m.course?.id && courseIds.add(m.course.id));
        [...stats.recent_sessions, ...stats.upcoming_sessions].forEach(
          (s) => s.course?.id && courseIds.add(s.course.id),
        );

        const results = await Promise.all(
          [...courseIds].slice(0, 8).map((courseId) =>
            academyApi.learners({ course_id: courseId, per_page: 100 }).catch(() => null),
          ),
        );

        if (!active) return;
        const merged = new Map<string, Learner>();
        results.forEach((res) => res?.data.forEach((learner) => merged.set(learner.id, learner)));
        setLearners([...merged.values()]);
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
  }, [t]);

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    data?.assigned_modules.forEach((m) => {
      if (m.course) map.set(m.course.id, m.course);
    });
    [...(data?.recent_sessions ?? []), ...(data?.upcoming_sessions ?? [])].forEach((s) => {
      if (s.course) map.set(s.course.id, s.course);
    });
    return [...map.values()];
  }, [data]);

  if (isLoading) return <SkeletonDashboard />;

  if (loadError) {
    return <p className="text-sm text-error-500">{loadError}</p>;
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.selfNoProfile')}</p>
      </div>
    );
  }

  const { trainer, stats } = data;
  const fullName =
    [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email || '—';
  const agencyName = data.recent_sessions[0]?.agency?.name ?? data.upcoming_sessions[0]?.agency?.name;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('academy.trainerDashboardTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fullName}
          {agencyName ? ` · ${agencyName}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label={t('nav.sessions')}
          value={stats.sessions_total}
          icon={CalendarDays}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('academy.sessionsUpcoming')}
          value={stats.sessions_upcoming}
          icon={CalendarClock}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('academy.learnersTrained')}
          value={stats.learners_unique}
          icon={Users}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('nav.courses')}
          value={courses.length}
          icon={BookOpen}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <BookOpen className="h-4 w-4" />
          {t('academy.selfFormations')}
        </h2>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noTrainers')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="rounded-xl border border-gray-100 p-4 dark:border-gray-800"
              >
                <p className="font-medium text-gray-800 dark:text-gray-100">{course.name}</p>
                <p className="mt-0.5 text-xs text-gray-400">{course.code}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <GraduationCap className="h-4 w-4" />
            {t('academy.selfLearners')}
          </h2>
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <UserCheck className="h-4 w-4" />
            {stats.learners_unique}
          </span>
        </div>
        {learners.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noLearners')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t('academy.learner')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('users.colEmail')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                  <th className="pb-2 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {learners.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                      {[row.learner.first_name, row.learner.last_name].filter(Boolean).join(' ') ||
                        row.learner.email ||
                        '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {row.learner.email ?? '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {row.primary?.course_name ?? row.session?.course?.name ?? '—'}
                    </td>
                    <td className="py-2.5">
                      {row.status === 'completed' ? (
                        <Badge variant="success">{t('academy.statusCompletedSession')}</Badge>
                      ) : row.status === 'cancelled' ? (
                        <Badge variant="error">{t('academy.statusCancelled')}</Badge>
                      ) : (
                        <Badge variant="brand">{t('academy.statusPlanned')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SessionTable
        title={t('academy.selfSessions')}
        icon={CalendarDays}
        sessions={data.recent_sessions}
        emptyLabel={t('academy.noSessions')}
      />

      <SessionTable
        title={t('academy.selfPlanning')}
        icon={CalendarClock}
        sessions={data.upcoming_sessions}
        emptyLabel={t('academy.noSessions')}
      />
    </div>
  );
}
