import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, Eye, Pencil, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formationsApi } from '@/api/formations.api';
import { servicesApi } from '@/api/services.api';
import { categoriesApi } from '@/api/categories.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { FormationFormModal } from '@/components/formations/FormationFormModal';
import { FormationDetailModal } from '@/components/formations/FormationDetailModal';
import {
  canCreateService,
  canDeleteService,
  canEditService,
} from '@/utils/catalogPermissions';
import { currentLocale } from '@/i18n';
import type { Formation } from '@/types/formation';
import type { Category } from '@/types/category';
import type { Service } from '@/types/service';
import type { PaginationMeta } from '@/types/agency';

export default function FormationListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formations, setFormations] = useState<Formation[]>([]);
  const [eligibleServices, setEligibleServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailFormation, setDetailFormation] = useState<Formation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Formation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFormations = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await formationsApi.list({
        search: search || undefined,
        category_id: categoryFilter || undefined,
        page,
        per_page: 15,
      });
      setFormations(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('formations.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchFormations();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchFormations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    categoriesApi.list({ per_page: 100 }).then((r) => setCategories(r.data)).catch(() => {});
    servicesApi
      .list({ per_page: 100 })
      .then((r) => setEligibleServices(r.data.filter((s) => !s.is_formation)))
      .catch(() => {});
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await formationsApi.remove(deleteTarget.id);
      showToast(t('formations.deleted'), 'success');
      setDeleteTarget(null);
      fetchFormations();
    } catch (error) {
      showToast(extractErrorMessage(error, t('formations.deleteFailed')), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  function openDetail(formation: Formation) {
    setDetailFormation(formation);
    setDetailId(formation.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('formations.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('formations.subtitle')}</p>
        </div>
        {canCreateService(user) && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('formations.newFormation')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.search')}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('formations.searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="sm:w-52">
          <Select
            label={t('formations.category')}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t('formations.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : formations.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('formations.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('formations.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('formations.category')}</th>
                  <th className="px-5 py-3 font-medium">{t('formations.colType')}</th>
                  <th className="px-5 py-3 font-medium">{t('formations.colDuration')}</th>
                  <th className="px-5 py-3 font-medium">{t('formations.colPrice')}</th>
                  <th className="px-5 py-3 font-medium">{t('formations.colModules')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {formations.map((formation) => (
                  <tr key={formation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {formation.service?.cover_image ? (
                          <img
                            src={formation.service.cover_image}
                            alt={formation.service.name}
                            className="h-10 w-10 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <GraduationCap className="h-5 w-5 text-brand-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-100">
                            {formation.service?.name ?? formation.id}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formation.service?.category?.name ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formation.service?.category?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {formation.type === 'presentiel' ? (
                        <Badge variant="success">{t('formations.presentiel')}</Badge>
                      ) : (
                        <Badge variant="brand">{t('formations.distanciel')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formation.duration ?? '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {new Intl.NumberFormat(currentLocale()).format(
                        Number(formation.service?.effective_price ?? formation.service?.price ?? 0)
                      )}
                      <span className="ml-1 text-xs text-gray-400">FCFA</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formation.modules_count ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(formation)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditService(user) && (
                          <button
                            type="button"
                            onClick={() => openDetail(formation)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteService(user) && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(formation)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <FormationFormModal
        isOpen={createModalOpen}
        formation={null}
        services={eligibleServices}
        onClose={() => setCreateModalOpen(false)}
        onSaved={fetchFormations}
      />

      <FormationDetailModal
        formationId={detailId}
        initial={detailFormation}
        onClose={() => {
          setDetailId(null);
          setDetailFormation(null);
        }}
        onChanged={fetchFormations}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('formations.deleteTitle')}
        message={t('formations.deleteMessage', { name: deleteTarget?.service?.name ?? '' })}
        confirmLabel={t('formations.delete')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
