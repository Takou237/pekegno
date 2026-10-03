import { useTranslation } from 'react-i18next';
import {
  ACTION_STATUS_COLORS,
  PRESTATION_STATUS_COLORS,
  type ActionStatus,
  type PrestationStatus,
} from '@/types/agencyDepartment';

export function PrestationStatusBadge({ status }: { status: PrestationStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PRESTATION_STATUS_COLORS[status]}`}>
      {t(`agencyDept.prestationStatus.${status}`)}
    </span>
  );
}

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STATUS_COLORS[status]}`}>
      {t(`agencyDept.actionStatus.${status}`)}
    </span>
  );
}

export function ContractStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    active: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    due_soon: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
    expired: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
    terminated: 'bg-gray-200 text-gray-500 dark:bg-gray-600/10 dark:text-gray-500',
    renewed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.draft}`}>
      {t(`agencyDept.contractStatus.${status}`, status)}
    </span>
  );
}
