import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import type { TrainerSessionItem } from '@/api/academy.api';
import { currentLocale } from '@/i18n';

export function StatCard({
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

export function SessionStatusBadge({ status }: { status: TrainerSessionItem['status'] }) {
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

export function TrainerSessionsTable({
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
