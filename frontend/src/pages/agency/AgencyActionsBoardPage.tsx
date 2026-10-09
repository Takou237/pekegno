import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { canUpdateActionExecution } from '@/utils/agencyDeptPermissions';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ActionStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { ACTION_STATUSES, personName, type ActionType, type LaravelPage, type PrestationAction } from '@/types/agencyDepartment';

/**
 * Vues transverses des actions (§6.5), réunies sous le menu « Suivi des
 * actions » : Toutes, Community Management (community + contenu), Publicité
 * et chaque autre type d'action (production, coaching, stratégie, autres).
 */
export type ActionsBoardMode = 'community' | 'advertising' | 'all' | ActionType;

export default function AgencyActionsBoardPage({ mode }: { mode: ActionsBoardMode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { departmentId, basePath } = useAgencyDept();
  const types =
    mode === 'advertising'
      ? 'advertising'
      : mode === 'community'
        ? 'community_management,content_production'
        : mode === 'all'
          ? undefined
          : mode;

  const title =
    mode === 'advertising'
      ? t('nav.advertising')
      : mode === 'community'
        ? t('nav.communityManagement')
        : mode === 'all'
          ? t('nav.actionsBoard')
          : t(`agencyDept.actionType.${mode}`);
  const subtitle =
    mode === 'advertising'
      ? t('agencyDept.board.advertisingSubtitle')
      : mode === 'community'
        ? t('agencyDept.board.communitySubtitle')
        : mode === 'all'
          ? t('agencyDept.board.allSubtitle')
          : t('agencyDept.board.typeSubtitle', { type: t(`agencyDept.actionType.${mode}`) });
  const showPassThrough = mode === 'advertising' || mode === 'all';

  const [result, setResult] = useState<(LaravelPage<PrestationAction> & { budget: { allocated: number; spent: number; pass_through: number } }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const canExecute = canUpdateActionExecution(user);

  const load = useCallback(() => {
    if (!departmentId) return;
    agencyDeptApi
      .actionsBoard({ department_id: departmentId, type: types, status: status || undefined, overdue: onlyOverdue || undefined, page, per_page: 25 })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, types, status, onlyOverdue, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(a: PrestationAction, s: string) {
    try {
      await agencyDeptApi.actionStatus(a.id, s);
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>

      {result && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t('agencyDept.budget.allocated')} value={formatCurrency(result.budget.allocated)} />
          <Stat label={t('agencyDept.budget.spent')} value={formatCurrency(result.budget.spent)} />
          {showPassThrough && <Stat label={t('agencyDept.budget.passThrough')} value={formatCurrency(result.budget.pass_through)} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t('agencyDept.allStatuses')}</option>
          {ACTION_STATUSES.map((s) => <option key={s} value={s}>{t(`agencyDept.actionStatus.${s}`)}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => { setOnlyOverdue(e.target.checked); setPage(1); }} />
          {t('agencyDept.board.onlyOverdue')}
        </label>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.actions.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.actions.title')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.prestation')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.actions.rhythm')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.budget.title')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.actions.assignee')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.actions.dueDate')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {result.data.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{a.title}</p>
                      <p className="text-xs text-gray-400">{a.platform ?? t(`agencyDept.actionType.${a.type}`)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {a.prestation && (
                        <Link to={`${basePath}/prestations/${a.prestation.id}`} className="text-brand-600 hover:underline">{a.prestation.name}</Link>
                      )}
                      <p className="text-xs text-gray-400">{personName(a.prestation?.client)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{a.quantity} × {t(`agencyDept.frequency.${a.frequency}`)} · {a.quantity_done} {t('agencyDept.board.done')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{formatCurrency(a.budget)}{a.actual_cost ? ` / ${formatCurrency(a.actual_cost)}` : ''}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{personName(a.assignee)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${a.is_overdue ? 'font-medium text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>{a.due_date?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3">
                      {canExecute ? (
                        <select value={a.status} onChange={(e) => changeStatus(a, e.target.value)} className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-gray-700 dark:text-white">
                          {ACTION_STATUSES.map((s) => <option key={s} value={s}>{t(`agencyDept.actionStatus.${s}`)}</option>)}
                        </select>
                      ) : <ActionStatusBadge status={a.status} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.last_page > 1 && (
        <Pagination currentPage={result.current_page} lastPage={result.last_page} total={result.total} perPage={result.per_page} onPageChange={setPage} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
