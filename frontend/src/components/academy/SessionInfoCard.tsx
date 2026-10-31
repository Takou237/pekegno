import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, User, Users } from 'lucide-react';
import { currentLocale } from '@/i18n';
import type { SessionStatus, TrainingSession } from '@/types/formation';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(currentLocale(), { dateStyle: 'short', timeStyle: 'short' });
}

function statusKey(status: SessionStatus): string {
  switch (status) {
    case 'ongoing':
      return 'academy.statusOngoing';
    case 'completed':
      return 'academy.statusCompletedSession';
    case 'cancelled':
      return 'academy.statusCancelled';
    default:
      return 'academy.statusPlanned';
  }
}

/**
 * Récapitulatif de la session choisie dans un formulaire d'inscription :
 * dates, type de durée, formateur et places.
 */
export default function SessionInfoCard({ session }: { session?: TrainingSession | null }) {
  const { t } = useTranslation();
  if (!session) return null;

  const enrolled = session.enrollments_count ?? 0;
  const trainerName = session.trainer
    ? [session.trainer.first_name, session.trainer.last_name].filter(Boolean).join(' ') || session.trainer.email
    : null;
  const isUnlimited = session.duration_type === 'unlimited' || (!session.duration_type && !session.end_at);

  return (
    <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-sm text-gray-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-gray-200">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-900 dark:text-white">{t('academy.session')}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {t(statusKey(session.status))}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>
            <span className="text-gray-500 dark:text-gray-400">{t('academy.startAt')} : </span>
            {formatDateTime(session.start_at)}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>
            <span className="text-gray-500 dark:text-gray-400">{t('academy.endAt')} : </span>
            {isUnlimited || !session.end_at ? t('academy.unlimited') : formatDateTime(session.end_at)}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>
            <span className="text-gray-500 dark:text-gray-400">{t('academy.trainer')} : </span>
            {trainerName ?? '—'}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>
            <span className="text-gray-500 dark:text-gray-400">{t('academy.enrolled')} : </span>
            {session.max_capacity != null
              ? `${enrolled} / ${session.max_capacity} (${Math.max(0, session.max_capacity - enrolled)} ${t('academy.seatsLeft')})`
              : enrolled}
          </span>
        </div>
      </dl>
    </div>
  );
}
