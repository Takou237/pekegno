import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { academyApi, type Learner, type TrainerStats } from '@/api/academy.api';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonDashboard } from '@/components/ui/Skeleton';

export interface TrainerContextValue {
  data: TrainerStats;
  learners: Learner[];
  courses: { id: string; name: string; code: string }[];
}

/**
 * Espace formateur : charge une seule fois les statistiques du profil et les
 * apprenants des formations assurées, puis les partage aux pages enfants
 * (Formations, Apprenants, Sessions, Planning) via le contexte d'Outlet.
 */
export function TrainerLayout() {
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

        // Apprenants : ceux des formations assurées par le formateur
        // (modules assignés + sessions), via l'endpoint existant.
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

  const value: TrainerContextValue = { data, learners, courses };
  return <Outlet context={value} />;
}

export default TrainerLayout;
