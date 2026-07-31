import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { servicesApi, categoriesApi } from '@/api/services.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ServiceFormModal } from '@/components/services/ServiceFormModal';
import { ServiceDetailModal } from '@/components/services/ServiceDetailModal';
import {
  canCreateService,
  canDeleteService,
  canEditService,
  canManageServiceTrash,
} from '@/utils/servicePermissions';
import type { Agency, PaginationMeta } from '@/types/agency';
import type { Category } from '@/types/category';
import type { Service, ServiceListParams } from '@/types/service';
import { currentCurrency, currentLocale } from '@/i18n';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

function getSortOptions(t: TranslateFn): { value: NonNullable<ServiceListParams['sort_by']>; label: string }[] {
  return [
    { value: 'name', label: t('services.sortName') },
    { value: 'price', label: t('services.sortPrice') },
    { value: 'created_at', label: t('services.sortCreatedAt') },
  ];
}

function formatPrice(value: string | number): string {
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `${number.toLocaleString(currentLocale(), { maximumFractionDigits: 2 })} ${currentCurrency()}`;
}

export default function ServiceListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [sortBy, setSortBy] = useState<NonNullable<ServiceListParams['sort_by']>>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null,
  });
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await servicesApi.list({
        search: search || undefined,
        category_id: categoryId || undefined,
        agency_id: agencyId || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: 15,
      });
      setServices(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('services.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryId, agencyId, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchServices();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, agencyId, sortBy, sortOrder]);

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    categoriesApi
      .list()
      .then(setCategories)
      .catch(() => {});
    agenciesApi
      .list({ per_page: 100 })
      .then((response) => setAgencies(response.data))
      .catch(() => {});
  }, []);

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await servicesApi.remove(deleteTarget.id);
      showToast(t('services.archived'), 'success');
      setDeleteTarget(null);
      fetchServices();
    } catch (error) {
      showToast(
        extractErrorMessage(error, t('services.deleteFailed')),
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSaved(saved: Service) {
    setServices((prev) => {
      const exists = prev.some((service) => service.id === saved.id);
      return exists
        ? prev.map((service) => (service.id === saved.id ? saved : service))
        : [saved, ...prev];
    });
  }

  async function openDetail(service: Service) {
    try {
      const full = await servicesApi.get(service.id);
      setDetailService(full);
    } catch (error) {
      showToast(
        extractErrorMessage(error, t('services.detailLoadFailed')),
        'error'
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('services.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {canManageServiceTrash(user) && (
            <Link to="/services/trash">
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                {t('common.trash')}
              </Button>
            </Link>
          )}
          {canCreateService(user) && (
            <div className="w-48">
              <Button onClick={() => setFormModalState({ open: true, service: null })}>
                <Plus className="h-4 w-4" />
                {t('services.newService')}
              </Button>
            </div>
          )}
        </div>
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
              placeholder={t('services.searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('services.category')}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t('common.selectAll')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('services.agency')}
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            <option value="">{t('common.selectAll')}</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('services.sortBy')}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            {getSortOptions(t).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-14">
          <button
            type="button"
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? t('common.asc') : t('common.desc')}
            className="flex h-[42px] w-full items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : services.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('services.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('services.colService')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.colCategory')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.colAgencyDept')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.colPrice')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.colPromo')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {service.name}
                        </span>
                        {service.coverage && (
                          <span className="text-xs text-gray-400">{service.coverage}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {service.category?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {service.agency?.name ?? service.department?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span
                          className={`font-medium ${
                            service.has_active_promotion
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-gray-800 dark:text-gray-100'
                          }`}
                        >
                          {formatPrice(service.current_price)}
                        </span>
                        {service.has_active_promotion && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(service.price)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {service.has_active_promotion ? (
                        <Badge variant="success">{t('services.promoActive')}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('common.none')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(service)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditService(user) && (
                          <button
                            type="button"
                            onClick={() => setFormModalState({ open: true, service })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteService(user) && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(service)}
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

      <ServiceFormModal
        isOpen={formModalState.open}
        service={formModalState.service}
        onClose={() => setFormModalState({ open: false, service: null })}
        onSaved={handleSaved}
      />

      <ServiceDetailModal service={detailService} onClose={() => setDetailService(null)} />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('services.archiveTitle')}
        message={t('services.archiveMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('services.archive')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
