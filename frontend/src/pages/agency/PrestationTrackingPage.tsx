import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Search } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { canEditPrestation, canValidatePrestation } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PrestationStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { Stars } from '@/components/agencyDept/StarRating';
import { ReasonModal } from '@/components/agencyDept/ReasonModal';
import {
  PRESTATION_STATUSES,
  STATUSES_REQUIRING_REASON,
  type LaravelPage,
  type PrestationStatus,
  type TrackingRow,
} from '@/types/agencyDepartment';

const ENDPOINT: Partial<Record<PrestationStatus, Parameters<typeof agencyDeptApi.transition>[1]>> = {
  draft: 'back-to-draft',
  pending_validation: 'submit',
  validated: 'validate',
  in_progress: 'start',
  completed: 'complete',
  suspended: 'suspend',
  cancelled: 'cancel',
  rejected: 'reject',
};

/** Grand tableau « Suivi des prestations » : Prestations · Notes · Statut · Motif (§6.6). */
export default function PrestationTrackingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { departmentId, basePath } = useAgencyDept();

  const [result, setResult] = useState<LaravelPage<TrackingRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', min_rating: '', from: '', to: '', sort: 'created_at', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ row: TrackingRow; status: PrestationStatus } | null>(null);

  const params = useCallback(() => ({
    department_id: departmentId,
    search: filters.search || undefined,
    status: filters.status || undefined,
    min_rating: filters.min_rating || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    sort: filters.sort,
    direction: filters.direction,
  }), [departmentId, filters]);

  const load = useCallback(() => {
    if (!departmentId) return;
    agencyDeptApi
      .tracking({ ...params(), page, per_page: 25 })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, params, page, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function exportCsv() {
    try {
      const blob = await agencyDeptApi.exportTracking(params());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'suivi-prestations.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  async function apply(row: TrackingRow, status: PrestationStatus, reason?: string) {
    const endpoint = status === 'in_progress' && row.status === 'suspended' ? 'resume' : ENDPOINT[status];
    if (!endpoint) return;
    try {
      await agencyDeptApi.transition(row.id, endpoint, reason);
      setPending(null);
      showToast(t('agencyDept.prestations.statusChanged'), 'success');
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  function onChangeStatus(row: TrackingRow, status: PrestationStatus) {
    if (STATUSES_REQUIRING_REASON.includes(status)) setPending({ row, status });
    else apply(row, status);
  }

  const toggleSort = (field: string) =>
    setFilters((f) => ({ ...f, sort: field, direction: f.sort === field && f.direction === 'desc' ? 'asc' : 'desc' }));

  const allowedFor = (row: TrackingRow) =>
    row.allowed_transitions.filter((s) => (s === 'validated' || s === 'rejected' ? canValidatePrestation(user) : canEditPrestation(user)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.prestations')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.tracking.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> {t('common.export')}</Button>
      </div>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder={t('common.search')} value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} />
        </div>
        <Select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
          <option value="">{t('agencyDept.allStatuses')}</option>
          {PRESTATION_STATUSES.map((s) => <option key={s} value={s}>{t(`agencyDept.prestationStatus.${s}`)}</option>)}
        </Select>
        <Select value={filters.min_rating} onChange={(e) => { setFilters({ ...filters, min_rating: e.target.value }); setPage(1); }}>
          <option value="">{t('agencyDept.tracking.anyRating')}</option>
          {[4, 3, 2, 1].map((n) => <option key={n} value={n}>≥ {n} ★</option>)}
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.prestations.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('name')}>{t('nav.prestations')}</th>
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('rating_avg')}>{t('agencyDept.tracking.notes')}</th>
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('status')}>{t('common.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.tracking.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {result.data.map((row) => {
                  const allowed = allowedFor(row);
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <Link to={`${basePath}/prestations/${row.id}`} className="font-medium text-gray-900 hover:underline dark:text-white">{row.name}</Link>
                        <p className="text-xs text-gray-400">{row.reference} · {row.client ?? '—'} · {row.start_date} → {row.end_date}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.rating_avg != null ? (
                          <span className="inline-flex items-center gap-2">
                            <Stars value={row.rating_avg} size="h-3.5 w-3.5" />
                            <span className="text-xs text-gray-500">{row.rating_avg.toFixed(1)} ({row.rating_count})</span>
                          </span>
                        ) : <span className="text-xs text-gray-400">{t('agencyDept.reviews.none')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PrestationStatusBadge status={row.status} />
                          {allowed.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => e.target.value && onChangeStatus(row, e.target.value as PrestationStatus)}
                              className="rounded-md border border-gray-200 bg-transparent px-1.5 py-1 text-xs dark:border-gray-700 dark:text-white"
                            >
                              <option value="">{t('agencyDept.tracking.change')}</option>
                              {allowed.map((s) => <option key={s} value={s}>{t(`agencyDept.transition.${row.status === 'suspended' && s === 'in_progress' ? 'resume' : s}`)}</option>)}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-300">{row.status_reason ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.last_page > 1 && (
        <Pagination currentPage={result.current_page} lastPage={result.last_page} total={result.total} perPage={result.per_page} onPageChange={setPage} />
      )}

      <ReasonModal
        isOpen={!!pending}
        title={pending ? t(`agencyDept.transition.${pending.status}`) : ''}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && apply(pending.row, pending.status, reason)}
      />
    </div>
  );
}
