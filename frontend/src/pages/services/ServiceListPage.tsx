import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, ArrowUpDown, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { servicesApi } from '@/api/services.api';
import { categoriesApi } from '@/api/categories.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { ServiceFormModal } from '@/components/services/ServiceFormModal';
import { ServiceDetailModal } from '@/components/services/ServiceDetailModal';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import {
  canCreateService,
  canDeleteService,
  canEditService,
  canManageCatalogTrash,
} from '@/utils/catalogPermissions';
import { currentLocale } from '@/i18n';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Service } from '@/types/service';
import type { Category } from '@/types/category';
import type { Agency, PaginationMeta } from '@/types/agency';

interface ServiceListPageProps {
  agencyId?: string;
}

export default function ServiceListPage({ agencyId }: ServiceListPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category_id') ?? '');
  const [agencyFilter, setAgencyFilter] = useState(agencyId ?? '');
  const [isFormationFilter, setIsFormationFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null,
  });
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await servicesApi.list({
        search: search || undefined,
        category_id: categoryFilter || undefined,
        agency_id: agencyFilter || undefined,
        is_formation: isFormationFilter || undefined,
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
  }, [search, categoryFilter, agencyFilter, isFormationFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchServices();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, agencyFilter, isFormationFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoriesApi.list({ per_page: 100 });
      setCategories(response.data);
    } catch {
      // Le filtre catégorie reste vide si le chargement échoue.
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
  }, [fetchCategories]);

  function handleCategorySaved(saved: Category) {
    setCategoryFilter(saved.id);
    fetchCategories();
  }

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
      showToast(extractErrorMessage(error, t('services.deleteFailed')), 'error');
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

  function openDetail(service: Service) {
    setDetailService(service);
    setDetailId(service.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('services.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {canManageCatalogTrash(user) && (
            <Link to="/catalog/services/trash">
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                {t('common.trash')}
              </Button>
            </Link>
          )}
          {canCreateService(user) && (
            <Button variant="outline" onClick={() => setCategoryFormOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('categories.newCategory')}
            </Button>
          )}
          {canCreateService(user) && (
            <Button onClick={() => setFormModalState({ open: true, service: null })}>
              <Plus className="h-4 w-4" />
              {t('services.newService')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-end">
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
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t('services.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        {!agencyId && (
          <div className="sm:w-48">
            <Select
              label={t('services.agency')}
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
            >
              <option value="">{t('services.allAgencies')}</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="sm:w-44">
          <Select
            label={t('services.formationFilter')}
            value={isFormationFilter ? 'formations' : ''}
            onChange={(e) => setIsFormationFilter(e.target.value === 'formations')}
          >
            <option value="">{t('services.allServices')}</option>
            <option value="formations">{t('services.onlyFormations')}</option>
          </Select>
        </div>
        <div className="sm:w-40">
          <Select
            label={t('common.sortBy')}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="name">{t('common.sortName')}</option>
            <option value="price">{t('common.sortPrice')}</option>
            <option value="created_at">{t('common.sortCreatedAt')}</option>
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
                  <th className="px-5 py-3 font-medium">{t('services.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.category')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.attachedTo')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.colPrice')}</th>
                  <th className="px-5 py-3 font-medium">{t('services.colType')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {service.cover_image ? (
                          <img
                            src={service.cover_image}
                            alt={service.name}
                            className="h-10 w-10 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700"
                            style={{ backgroundColor: service.category?.color ?? '#CBD5E1' }}
                          >
                            <CategoryIcon
                              name={service.category?.icon}
                              className="h-5 w-5 text-white"
                            />
                          </div>
                        )}
                        <p className="font-medium text-gray-800 dark:text-gray-100">
                          {service.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {service.category ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                            style={{ backgroundColor: service.category.color ?? '#CBD5E1' }}
                          >
                            <CategoryIcon
                              name={service.category.icon}
                              className="h-3.5 w-3.5 text-white"
                            />
                          </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {service.category.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {service.agency?.name ?? service.department?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {Number(service.effective_price) !== Number(service.price) ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400 line-through">
                            {new Intl.NumberFormat(currentLocale()).format(Number(service.price))}
                          </span>
                          <span className="font-medium text-brand-600 dark:text-brand-400">
                            {new Intl.NumberFormat(currentLocale()).format(Number(service.effective_price))}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {new Intl.NumberFormat(currentLocale()).format(Number(service.price))}
                        </span>
                      )}
                      <span className="ml-1 text-xs text-gray-400">FCFA</span>
                    </td>
                    <td className="px-5 py-3">
                      {service.is_formation ? (
                        <Badge variant="success">
                          <GraduationCap className="mr-1 h-3 w-3" />
                          {t('services.formation')}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">{t('services.service')}</Badge>
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

      <CategoryFormModal
        isOpen={categoryFormOpen}
        category={null}
        onClose={() => setCategoryFormOpen(false)}
        onSaved={handleCategorySaved}
      />

      <ServiceDetailModal
        serviceId={detailId}
        initial={detailService}
        onClose={() => {
          setDetailId(null);
          setDetailService(null);
        }}
      />

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
