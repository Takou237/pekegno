import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Tag } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { canCreatePrestation, canManagePackages } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { SkeletonCards, SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// Même carte que la page département et l'onglet Packages du catalogue staff
// (caissier / commercial) : rendu strictement identique.
import { PackageCard, groupPackagesByCategory } from '@/components/packages/PackageCard';
import { PackageSubscribeModal } from '@/components/packages/PackageSubscribeModal';
import { PackageFormModal } from '@/components/agencyDept/PackageFormModal';
import { OfferFormModal } from '@/components/agencyDept/OfferFormModal';
import { Stars } from '@/components/agencyDept/StarRating';
import { type AgencyPackage, type LaravelPage, type PrestationOffer } from '@/types/agencyDepartment';

/**
 * Onglet « Agency » du catalogue (§6) : packs (§6.2) + offres de prestation
 * d'un pays ou d'une agence. Les offres mènent aux souscriptions clients,
 * dans le département concerné.
 */
export default function AgencyCatalogTab({ agencyId, countryId }: { agencyId?: string; countryId?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const canManage = canManagePackages(user);
  const canCreate = canCreatePrestation(user);

  const [packages, setPackages] = useState<AgencyPackage[]>([]);
  const [offers, setOffers] = useState<LaravelPage<PrestationOffer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyPackage | null>(null);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgencyPackage | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<AgencyPackage | null>(null);

  const scope = { agency_id: agencyId, country_id: countryId };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      agencyDeptApi.packages(scope),
      agencyDeptApi.offers({ ...scope, page, per_page: 15 }),
    ])
      .then(([pk, of]) => {
        setPackages(pk);
        setOffers(of);
      })
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, countryId, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Même regroupement que l'onglet Packages du catalogue staff (caissier) :
  // par catégorie, pas par agence.
  const grouped = groupPackagesByCategory(packages, t('agencyDept.packages.uncategorized'));

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agencyDeptApi.deletePackage(deleteTarget.id);
      showToast(t('agencyDept.deleted'), 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  function openOffer(o: PrestationOffer) {
    if (!o.department_id) return;
    navigate(`/departments/${o.department_id}/prestations/${o.id}/subscriptions`);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert variant="error">{error}</Alert>}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Tag className="h-4 w-4" /> {t('nav.packages')}
          </h2>
          {canManage && (
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> {t('agencyDept.packages.new')}
            </Button>
          )}
        </div>

        {loading ? (
          <SkeletonCards />
        ) : packages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            {t('agencyDept.catalog.emptyPacks')}
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.name} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Tag className="h-4 w-4" /> {group.name}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {group.items.map((p) => (
                  <PackageCard
                    key={p.id}
                    pkg={p}
                    canManage={canManage}
                    canSubscribe={canCreate && p.is_active}
                    showAgency={!agencyId}
                    onEdit={() => { setEditing(p); setFormOpen(true); }}
                    onPromo={undefined}
                    onSubscribe={() => setSubscribeTarget(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('nav.prestations')}
          </h2>
          {canCreate && (
            <Button size="sm" onClick={() => setOfferFormOpen(true)}>
              <Plus className="h-4 w-4" /> {t('agencyDept.offers.new')}
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          {!offers ? (
            <SkeletonTable />
          ) : offers.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.offers.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('agencyDept.offers.offer')}</th>
                    {!agencyId && <th className="px-4 py-3 font-medium">{t('agencyDept.agency')}</th>}
                    <th className="px-4 py-3 font-medium">{t('agencyDept.offers.subscriptions')}</th>
                    <th className="px-4 py-3 font-medium">{t('agencyDept.rating')}</th>
                    <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {offers.data.map((o) => {
                    const count = o.subscriptions_count ?? 0;
                    const avg = o.subscriptions_rating_avg ? Number(o.subscriptions_rating_avg) : null;
                    return (
                      <tr
                        key={o.id}
                        className={o.department_id ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                        onClick={() => openOffer(o)}
                      >
                        <td className="px-4 py-3">
                          {o.department_id ? (
                            <Link to={`/departments/${o.department_id}/prestations/${o.id}/subscriptions`} className="font-medium text-gray-900 hover:underline dark:text-white" onClick={(e) => e.stopPropagation()}>
                              {o.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-900 dark:text-white">{o.name}</span>
                          )}
                          <p className="text-xs text-gray-400">{o.category ? `${o.category.name} · ` : ''}{o.description ?? ''}</p>
                        </td>
                        {!agencyId && <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{o.agency?.name ?? '—'}</td>}
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{count}</td>
                        <td className="px-4 py-3">
                          {avg ? (
                            <span className="inline-flex items-center gap-1">
                              <Stars value={avg} size="h-3.5 w-3.5" />
                              <span className="text-xs text-gray-500">{avg.toFixed(1)}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                              o.is_active
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {t(o.is_active ? 'common.active' : 'common.inactive')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {offers && offers.last_page > 1 && (
          <Pagination
            currentPage={offers.current_page}
            lastPage={offers.last_page}
            total={offers.total}
            perPage={offers.per_page}
            onPageChange={setPage}
          />
        )}
      </section>

      <PackageFormModal
        isOpen={formOpen}
        agencyId={agencyId}
        countryId={countryId}
        editing={editing}
        canManage={canManage}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <OfferFormModal
        isOpen={offerFormOpen}
        agencyId={agencyId}
        countryId={countryId}
        onClose={() => setOfferFormOpen(false)}
        onSaved={() => {
          setOfferFormOpen(false);
          setPage(1);
          load();
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('agencyDept.packages.delete')}
        message={t('agencyDept.packages.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {subscribeTarget && (
        <PackageSubscribeModal
          pkg={subscribeTarget}
          departmentId={undefined}
          onClose={() => setSubscribeTarget(null)}
          onDone={() => { setSubscribeTarget(null); load(); }}
        />
      )}
    </div>
  );
}
