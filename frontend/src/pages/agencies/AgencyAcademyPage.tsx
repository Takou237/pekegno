import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Users, BookOpen, CalendarDays } from 'lucide-react';
import { academyApi } from '@/api/academy.api';
import AgencyAcademyFormations from '@/pages/academy/AgencyAcademyFormations';

export default function AgencyAcademyPage() {
  const params = useParams<{ agencyId?: string; departmentId?: string }>();
  const agencyId = params.agencyId ?? params.departmentId ?? '';
  const { t } = useTranslation();

  const [stats, setStats] = useState<{ learners: number; courses: number; sessions: number } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!agencyId) return;
        const [coursesRes, learnersRes, sessionsRes] = await Promise.all([
          academyApi.courses({ agency_id: agencyId, per_page: 1 }),
          academyApi.learners({ agency_id: agencyId, per_page: 1 }),
          academyApi.sessions({ agency_id: agencyId, per_page: 1 }),
        ]);
        if (!active) return;
        setStats({
          learners: learnersRes.meta?.total ?? 0,
          courses: coursesRes.meta?.total ?? 0,
          sessions: sessionsRes.meta?.total ?? 0,
        });
      } catch {
        if (active) setStats(null);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [agencyId]);

  const cards = [
    { label: t('academy.courses'), value: stats?.courses ?? 0, icon: BookOpen },
    { label: t('nav.learners'), value: stats?.learners ?? 0, icon: Users },
    { label: t('nav.sessions'), value: stats?.sessions ?? 0, icon: CalendarDays },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <GraduationCap className="h-5 w-5 text-brand-500" />
          {t('nav.academy')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.title')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <AgencyAcademyFormations agencyId={agencyId} />
    </div>
  );
}
