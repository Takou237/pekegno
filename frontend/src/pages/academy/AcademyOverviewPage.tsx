import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, GraduationCap, UserCog, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi } from '@/api/academy.api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { currentLocale } from '@/i18n';
import type { Agency } from '@/types/agency';
import type { Enrollment } from '@/api/academy.api';
import type { ReactNode } from 'react';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

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

export default function AcademyOverviewPage() {
  const { t } = useTranslation();
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  const [coursesTotal, setCoursesTotal] = useState<number | null>(null);
  const [trainersTotal, setTrainersTotal] = useState<number | null>(null);
  const [enrollmentsTotal, setEnrollmentsTotal] = useState<number | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    Promise.allSettled([
      academyApi.courses({ agency_id: agencyId, per_page: 1 }),
      academyApi.trainers({ agency_id: agencyId, per_page: 1 }),
      academyApi.enrollments({ agency_id: agencyId, per_page: 8 }),
    ])
      .then(([courses, trainers, enrollments]) => {
        if (!active) return;
        if (courses.status === 'fulfilled') setCoursesTotal(courses.value.meta.total);
        else setLoadError(t('academy.loadFailed'));
        if (trainers.status === 'fulfilled') setTrainersTotal(trainers.value.meta.total);
        if (enrollments.status === 'fulfilled') {
          setEnrollmentsTotal(enrollments.value.meta.total);
          setRecentEnrollments(enrollments.value.data);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [agencyId, t]);

  if (isLoading) return <SkeletonDashboard />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('academy.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.subtitle')}</p>
      </div>

      {loadError && <p className="text-sm text-error-500">{loadError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t('nav.courses')}
          value={coursesTotal ?? '—'}
          icon={<BookOpen className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('nav.trainers')}
          value={trainersTotal ?? '—'}
          icon={<GraduationCap className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('nav.learners')}
          value={enrollmentsTotal ?? '—'}
          icon={<UserCog className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <CalendarDays className="h-4 w-4" />
          {t('academy.recentEnrollments')}
        </h2>
        {recentEnrollments.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noEnrollments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t('academy.learner')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                  <th className="pb-2 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentEnrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                      {[e.learner?.first_name, e.learner?.last_name].filter(Boolean).join(' ') || e.learner?.email || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {e.session?.course?.name ?? '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {e.session?.start_at
                        ? new Date(e.session.start_at).toLocaleDateString(currentLocale())
                        : '—'}
                    </td>
                    <td className="py-2.5">
                      {e.status === 'completed' ? (
                        <Badge variant="success">{t('academy.statusCompleted')}</Badge>
                      ) : e.status === 'cancelled' ? (
                        <Badge variant="error">{t('academy.statusCancelled')}</Badge>
                      ) : (
                        <Badge variant="brand">{t('academy.statusEnrolled')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
