import { GraduationCap, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import type { TrainerContextValue } from './TrainerLayout';

export default function TrainerLearnersPage() {
  const { t } = useTranslation();
  const { data, learners } = useOutletContext<TrainerContextValue>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <GraduationCap className="h-5 w-5" />
          {t('academy.selfLearners')}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <UserCheck className="h-4 w-4" />
          {data.stats.learners_unique} {t('academy.learnersTrained').toLowerCase()}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
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
    </div>
  );
}
