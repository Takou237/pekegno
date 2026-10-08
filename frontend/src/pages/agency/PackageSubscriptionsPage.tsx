import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonDetail, SkeletonTable } from '@/components/ui/Skeleton';
import { PrestationStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { Stars } from '@/components/agencyDept/StarRating';
import { PRESTATION_STATUSES, personName, type AgencyPackage, type LaravelPage, type Prestation } from '@/types/agencyDepartment';

/**
 * Souscriptions d'un pack : les prestations générées à la souscription
 * (une par contrat). Elles n'apparaissent pas dans la liste des offres.
 */
export default function PackageSubscriptionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { basePath } = useAgencyDept();
  const { packageId } = useParams<{ packageId: string }>();

  const [pkg, setPkg] = useState<AgencyPackage | null>(null);
  const [result, setResult] = useState<LaravelPage<Prestation> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const loadPackage = useCallback(() => {
    if (!packageId) return;
    agencyDeptApi
      .package(packageId)
      .then(setPkg)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [packageId, t]);

  const load = useCallback(() => {
    if (!packageId) return;
    agencyDeptApi
      .prestations({
        package_id: packageId,
        search: search || undefined,
        status: status || undefined,
        page,
        per_page: 15,
      })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [packageId, search, status, page, t]);

  useEffect(() => {
    loadPackage();
  }, [loadPackage]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <Link to={`${basePath}/packages`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400">
        <ArrowLeft className="h-4 w-4" /> {t('nav.packages')}
      </Link>

      {!pkg ? (
        <SkeletonDetail />
      ) : (
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{pkg.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.packages.subscriptionsHint')}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t('agencyDept.allStatuses')}</option>
          {PRESTATION_STATUSES.map((s) => <option key={s} value={s}>{t(`agencyDept.prestationStatus.${s}`)}</option>)}
        </Select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.packages.noSubscriptions')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.prestation')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.client')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.commercial')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.period')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.budget.title')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.rating')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {result.data.map((p) => {
                  const budget = Number(p.budget);
                  const pct = budget > 0 ? Math.min(100, (p.budget_allocated / budget) * 100) : 0;
                  const to = `${basePath}/prestations/${p.id}`;
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => navigate(to)}>
                      <td className="px-4 py-3">
                        <Link to={to} className="font-medium text-gray-900 hover:underline dark:text-white" onClick={(e) => e.stopPropagation()}>
                          {p.name}
                        </Link>
                        <p className="text-xs text-gray-400">{p.reference}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{personName(p.client)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{personName(p.commercial)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{p.start_date.slice(0, 10)} → {p.end_date.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-gray-700 dark:text-gray-200">{formatCurrency(budget)}</p>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.rating_avg ? <span className="inline-flex items-center gap-1"><Stars value={Number(p.rating_avg)} size="h-3.5 w-3.5" /><span className="text-xs text-gray-500">{Number(p.rating_avg).toFixed(1)}</span></span> : '—'}
                      </td>
                      <td className="px-4 py-3"><PrestationStatusBadge status={p.status} /></td>
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
    </div>
  );
}
