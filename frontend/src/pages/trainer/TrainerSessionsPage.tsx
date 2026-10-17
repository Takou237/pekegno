import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import type { TrainerContextValue } from './TrainerLayout';
import { TrainerSessionsTable } from './trainerShared';

export default function TrainerSessionsPage() {
  const { t } = useTranslation();
  const { data } = useOutletContext<TrainerContextValue>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <CalendarDays className="h-5 w-5" />
          {t('academy.selfSessions')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('nav.sessions')} · {data.stats.sessions_total}
        </p>
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
