import { BookOpen, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import type { TrainerContextValue } from './TrainerLayout';

export default function TrainerCoursesPage() {
  const { t } = useTranslation();
  const { data, courses } = useOutletContext<TrainerContextValue>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <BookOpen className="h-5 w-5" />
          {t('academy.selfFormations')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('nav.courses')} · {courses.length}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        {courses.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noTrainers')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <div key={course.id} className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                <p className="font-medium text-gray-800 dark:text-gray-100">{course.name}</p>
                <p className="mt-0.5 text-xs text-gray-400">{course.code}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <Layers className="h-4 w-4" />
          {t('academy.modules')}
        </h2>
        {data.assigned_modules.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noModules')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t('academy.module')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                  <th className="pb-2 font-medium">{t('academy.order')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.assigned_modules.map((module) => (
                  <tr key={module.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                      {module.name}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {module.course?.name ?? '—'}
                    </td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-300">{module.order_index}</td>
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
