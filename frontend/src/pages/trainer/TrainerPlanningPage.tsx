import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import type { TrainerContextValue } from './TrainerLayout';
import { TrainerSessionsTable } from './trainerShared';

export default function TrainerPlanningPage() {
  const { t } = useTranslation();
  const { data } = useOutletContext<TrainerContextValue>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <CalendarClock className="h-5 w-5" />
          {t('academy.selfPlanning')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('academy.sessionsUpcoming')} · {data.stats.sessions_upcoming}
        </p>
      </div>

      <TrainerSessionsTable
        title={t('academy.selfPlanning')}
        icon={CalendarClock}
        sessions={data.upcoming_sessions}
        emptyLabel={t('academy.noSessions')}
      />
    </div>
  );
}
