import { CalendarClock, CalendarDays, BookOpen, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import type { TrainerContextValue } from './TrainerLayout';
import { StatCard, TrainerSessionsTable } from './trainerShared';

export default function TrainerOverviewPage() {
  const { t } = useTranslation();
  const { data, courses } = useOutletContext<TrainerContextValue>();
  const { trainer, stats } = data;

  const fullName =
    [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email || '—';
  const agencyName =
    data.recent_sessions[0]?.agency?.name ?? data.upcoming_sessions[0]?.agency?.name;

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

      <TrainerSessionsTable
        title={t('academy.selfSessions')}
        icon={CalendarDays}
        sessions={data.recent_sessions}
        emptyLabel={t('academy.noSessions')}
      />
    </div>
  );
}
