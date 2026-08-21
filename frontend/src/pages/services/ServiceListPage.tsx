import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, Copy, Download, ArrowUpDown, Building2, MapPin, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { servicesApi } from '@/api/services.api';
import { categoriesApi } from '@/api/categories.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ServiceFormModal } from '@/components/services/ServiceFormModal';
import { ServiceDetailModal } from '@/components/services/ServiceDetailModal';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import {
  canCreateService,
  canDeleteService,
  canEditService,
  canManageCatalogTrash,
  canViewAgencies,
} from '@/utils/catalogPermissions';
import { canExportData } from '@/utils/exportPermissions';
import { currentLocale } from '@/i18n';
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
  const { countryId } = useParams<{ countryId?: string }>();
  const [searchParams] = useSearchParams();

  const servicesBase = agencyId
    ? countryId
      ? `/countries/${countryId}/agencies/${agencyId}/services`
      : `/agencies/${agencyId}/services`
    : countryId
      ? `/countries/${countryId}/catalog/services`
      : '/catalog/services';

  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category_id') ?? '');
  const [agencyFilter, setAgencyFilter] = useState(agencyId ?? '');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null,
  });
  const [duplicateSource, setDuplicateSource] = useState<Service | null>(null);
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
  }, [search, categoryFilter, agencyFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchServices();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, agencyFilter, sortBy, sortOrder]);

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
    if (canViewAgencies(user)) {
      agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
    }
  }, [fetchCategories, user]);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('services');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

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

  function formatPrice(value: string): string {
    return `${new Intl.NumberFormat(currentLocale()).format(Number(value))} FCFA`;
  }

  const hasPromo = (service: Service) => Number(service.effective_price) !== Number(service.price);

  const activePromotion = (service: Service) =>
    (service.promotions ?? [])
      .filter((promotion) => promotion.is_active)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const discountPercent = (service: Service): number | null => {
    const promotion = activePromotion(service);
    if (!promotion) return null;
    if (promotion.type === 'percent' && promotion.discount_percent != null) {
      return Number(promotion.discount_percent);
    }
    if (promotion.type === 'amount' && promotion.promo_price != null) {
      const original = Number(service.price);
      const promo = Number(promotion.promo_price);
      if (original > 0 && promo < original) {
        return Math.round(((original - promo) / original) * 100);
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('services.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canExportData(user) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('services.export')}
            </Button>
          )}
          {canManageCatalogTrash(user) && (
            <Link to={`${servicesBase}/trash`}>
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
        {!agencyId && canViewAgencies(user) && (
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
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : services.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('services.empty')}</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => openDetail(service)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                {service.cover_image ? (
                  <div className="relative">
                    <div
                      className="h-32 w-full shrink-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${service.cover_image})` }}
                      role="img"
                      aria-label={service.name}
                    />
                    {service.presentation_video && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-600 shadow-lg">
                          <Play className="ml-0.5 h-5 w-5" />
                        </span>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex h-32 w-full shrink-0 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                    <span className="text-sm font-bold uppercase tracking-[0.35em] text-gray-400 dark:text-gray-600">
                      PEKEGNO
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{service.name}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">{service.category?.name}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(service);
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                        title={t('common.viewDetails')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canCreateService(user) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDuplicateSource(service);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-purple-600 dark:hover:bg-gray-800"
                          title={t('services.duplicate')}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                      {canEditService(user) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormModalState({ open: true, service });
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDeleteService(user) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(service);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {service.description && (
                    <p className="mt-3 line-clamp-2 flex-1 text-sm text-gray-500 dark:text-gray-400">
                      {service.description}
                    </p>
                  )}

                  {service.is_seminar && service.seminar_tiers.length > 0 ? (
                    <div className="mt-4 space-y-1">
                      {service.seminar_tiers.map((tier) => (
                        <div key={tier.tier} className="flex items-baseline justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">{tier.label}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formatPrice(tier.price)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatPrice(service.effective_price)}
                      </span>
                      {hasPromo(service) && (
                        <span className="text-xs text-gray-400 line-through">{formatPrice(service.price)}</span>
                      )}
                      {discountPercent(service) != null && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400">
                          -{new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 0 }).format(discountPercent(service) as number)}%
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {service.bonus_fixed && Number(service.bonus_fixed) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {t('services.bonusFixed')}: {formatPrice(service.bonus_fixed)}
                      </span>
                    )}
                    {service.is_seminar && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        {t('services.isSeminar')}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{service.agency?.name ?? '—'}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {service.agency?.city ?? ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
        isOpen={formModalState.open || Boolean(duplicateSource)}
        service={formModalState.service}
        duplicateSource={duplicateSource}
        agencyId={agencyId}
        onClose={() => {
          setFormModalState({ open: false, service: null });
          setDuplicateSource(null);
        }}
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
