import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, ShieldCheck, Building2, Calendar } from 'lucide-react';
import { client } from '@/api/client';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department: Department | null;
  departmentId?: string;
  refreshDepartment?: () => void;
}

export default function DepartmentOverviewPage() {
  const { t } = useTranslation();
  const { department, departmentId } = useOutletContext<DepartmentLayoutContext>();
  const [usersCount, setUsersCount] = useState<number | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    client
      .get(`/departments/${departmentId}/users`)
      .then(({ data }) => {
        setUsersCount((data.data ?? data).length);
      })
      .catch(() => setUsersCount(0));
  }, [departmentId]);

  if (!department) {
    return <p className="text-sm text-error-500">{t('departments.empty')}</p>;
  }

  const stats = [
    {
      label: t('departments.colCount'),
      value: usersCount ?? 0,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
    },
    {
      label: t('departments.agency'),
      value: department.agency?.name ?? '—',
      icon: Building2,
      to: department.agency ? `/agencies/${department.agency_id}` : undefined,
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
    },
    {
      label: t('departments.chiefOfDepartment'),
      value: department.department_chief?.name ?? '—',
      icon: ShieldCheck,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, to, color, bg }) =>
          to ? (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </Link>
          ) : (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{department.name}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.description')}</dt>
            <dd className="mt-1 text-gray-800 dark:text-gray-100">
              {department.description ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.agency')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <Building2 className="h-4 w-4 text-gray-400" />
              {department.agency?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.chiefOfDepartment')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              {department.department_chief?.name ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('departments.createdAt')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <Calendar className="h-4 w-4 text-gray-400" />
              {new Date(department.created_at).toLocaleDateString(currentLocale())}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
