import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, Plus, Search } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { canCreatePrestation, canEditPrestation } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonDetail, SkeletonTable } from '@/components/ui/Skeleton';
import { PrestationStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { Stars } from '@/components/agencyDept/StarRating';
import { PrestationFormModal } from '@/components/agencyDept/PrestationFormModal';
import { OfferFormModal } from '@/components/agencyDept/OfferFormModal';
import { PRESTATION_STATUSES, personName, type LaravelPage, type Prestation, type PrestationOffer } from '@/types/agencyDepartment';

/**
 * Niveau 2 des prestations : les souscriptions clients d'une offre, puis le
 * clic sur une ligne mène au détail (niveau 3).
 */
export default function PrestationOfferSubscriptionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { departmentId, agencyId, basePath } = useAgencyDept();
  const { offerId } = useParams<{ offerId: string }>();

  const [offer, setOffer] = useState<PrestationOffer | null>(null);
  const [result, setResult] = useState<LaravelPage<Prestation> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOfferOpen, setEditOfferOpen] = useState(false);

  const loadOffer = useCallback(() => {
    if (!offerId) return;
    agencyDeptApi
      .offer(offerId)
      .then(setOffer)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [offerId, t]);

  const load = useCallback(() => {
    if (!offerId) return;
    agencyDeptApi
      .prestations({
        offer_id: offerId,
        search: search || undefined,
        status: status || undefined,
        page,
        per_page: 15,
      })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [offerId, search, status, page, t]);

  useEffect(() => {
    loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <Link to={`${basePath}/prestations`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400">
        <ArrowLeft className="h-4 w-4" /> {t('agencyDept.offers.title')}
      </Link>

      {!offer ? (
        <SkeletonDetail />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{offer.name}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('agencyDept.offers.subscriptionsHint')}
              {offer.category ? ` · ${offer.category.name}` : ''}
              {offer.description ? ` · ${offer.description}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditPrestation(user) && (
              <Button variant="outline" onClick={() => setEditOfferOpen(true)}>
                <Pencil className="h-4 w-4" /> {t('common.edit')}
              </Button>
            )}
            {canCreatePrestation(user) && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> {t('agencyDept.prestations.newSubscription')}
              </Button>
            )}
          </div>
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
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.prestations.empty')}</p>
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
                  const to = `${basePath}/prestations/${offerId}/subscriptions/${p.id}`;
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => navigate(to)}>
                      <td className="px-4 py-3">
                        <Link to={to} className="font-medium text-gray-900 hover:underline dark:text-white" onClick={(e) => e.stopPropagation()}>
                          {p.name}
                        </Link>
                        <p className="text-xs text-gray-400">{p.reference}{p.category ? ` · ${p.category.name}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{personName(p.client)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{personName(p.commercial)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{p.start_date ? p.start_date.slice(0, 10) : '—'} → {p.end_date ? p.end_date.slice(0, 10) : '—'}</td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{formatCurrency(budget)}</p>
                        <p className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {t('agencyDept.budget.spent')} : {formatCurrency(p.budget_spent)}
                        </p>
                        <p className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {t('agencyDept.budget.remaining')} : {formatCurrency(p.budget_remaining)}
                        </p>
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

      <PrestationFormModal
        isOpen={createOpen}
        offer={offer}
        agencyId={agencyId ?? offer?.agency_id}
        departmentId={departmentId ?? offer?.department_id ?? undefined}
        onClose={() => setCreateOpen(false)}
        onSaved={(p) => {
          setCreateOpen(false);
          setPage(1);
          load();
          navigate(`${basePath}/prestations/${offerId}/subscriptions/${p.id}`);
        }}
      />

      <OfferFormModal
        isOpen={editOfferOpen}
        offer={offer}
        agencyId={agencyId}
        departmentId={departmentId}
        onClose={() => setEditOfferOpen(false)}
        onSaved={(o) => { setOffer(o); load(); }}
      />
    </div>
  );
}
