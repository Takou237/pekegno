import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { useToast } from '@/hooks/useToast';
import { canCreatePrestation, canEditPrestation } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Stars } from '@/components/agencyDept/StarRating';
import { OfferFormModal } from '@/components/agencyDept/OfferFormModal';
import type { LaravelPage, PrestationOffer } from '@/types/agencyDepartment';

/**
 * Catalogue des offres de prestation (niveau 1 des prestations) : chaque
 * ligne mène aux souscriptions clients de l'offre, puis au détail d'une
 * souscription. Les prestations issues d'un pack ne figurent pas ici.
 */
export default function PrestationOffersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { departmentId, agencyId, basePath } = useAgencyDept();

  const [result, setResult] = useState<LaravelPage<PrestationOffer> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PrestationOffer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrestationOffer | null>(null);

  const load = useCallback(() => {
    if (!departmentId) return;
    agencyDeptApi
      .offers({
        department_id: departmentId,
        search: search || undefined,
        is_active: active || undefined,
        page,
        per_page: 15,
      })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, search, active, page, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agencyDeptApi.deleteOffer(deleteTarget.id);
      showToast(t('agencyDept.deleted'), 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  const canManage = canEditPrestation(user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('agencyDept.offers.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.offers.subtitle')}</p>
        </div>
        {canCreatePrestation(user) && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> {t('agencyDept.offers.new')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
          <option value="">{t('common.all')}</option>
          <option value="1">{t('common.active')}</option>
          <option value="0">{t('common.inactive')}</option>
        </Select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.offers.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.offers.offer')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.offers.subscriptions')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.rating')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  {canManage && <th className="px-4 py-3 font-medium">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {result.data.map((o) => {
                  const count = o.subscriptions_count ?? 0;
                  const avg = o.subscriptions_rating_avg ? Number(o.subscriptions_rating_avg) : null;
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() => navigate(`${basePath}/prestations/${o.id}/subscriptions`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`${basePath}/prestations/${o.id}/subscriptions`}
                          className="font-medium text-gray-900 hover:underline dark:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.name}
                        </Link>
                        <p className="text-xs text-gray-400">
                          {o.category ? `${o.category.name} · ` : ''}{o.description ?? t('agencyDept.offers.noDescription')}
                        </p>
                      </td>
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
                      {canManage && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setEditing(o); setFormOpen(true); }} title={t('common.edit')}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(o)} title={t('common.delete')}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
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

      <OfferFormModal
        isOpen={formOpen}
        offer={editing}
        agencyId={agencyId}
        departmentId={departmentId}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setPage(1); load(); }}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('agencyDept.offers.delete')}
        message={t('agencyDept.offers.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
