import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, Copy, Download, ArrowUpDown, Building2, MapPin, Play, Tag, ShoppingCart, GraduationCap, UserPlus } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { academyApi, type Course } from '@/api/academy.api';
import type { AgencyPackage, LaravelPage, PrestationOffer } from '@/types/agencyDepartment';
import { Stars } from '@/components/agencyDept/StarRating';
import { PackageSubscribeModal } from '@/components/packages/PackageSubscribeModal';
import { PackageCard, groupPackagesByCategory } from '@/components/packages/PackageCard';
import { canSubscribePackage, canCreatePrestation } from '@/utils/agencyDeptPermissions';
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
import AgencyCatalogTab from '@/pages/services/AgencyCatalogTab';
import FormationEnrollmentModal from '@/components/academy/FormationEnrollmentModal';
import { PrestationFormModal } from '@/components/agencyDept/PrestationFormModal';
import PromotionFormModal from '@/components/promotions/PromotionFormModal';
import QuickSaleModal from '@/components/invoices/QuickSaleModal';
import {
  canCreateService,
  canDeleteService,
  canEditService,
  canManageCatalogTrash,
  canViewAgencies,
} from '@/utils/catalogPermissions';
import { canExportData } from '@/utils/exportPermissions';
import { canEnrollLearners } from '@/utils/academyPermissions';
import { currentLocale } from '@/i18n';
import { commercialsApi } from '@/api/commercials.api';
import type { Service } from '@/types/service';
import type { Category } from '@/types/category';
import type { Agency, PaginationMeta } from '@/types/agency';
import type { Promotion } from '@/types/promotion';
import { currencyLabel } from '@/utils/number';

interface ServiceListPageProps {
  agencyId?: string;
  showAcademyTabs?: boolean;
}

export default function ServiceListPage({ agencyId, showAcademyTabs = false }: ServiceListPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { countryId } = useParams<{ countryId?: string }>();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'services' | 'formations' | 'packages' | 'agency'>('services');
  const navigate = useNavigate();

  const isCommercial = user?.role?.name === 'commercial';
  const isCaissier = user?.role?.name === 'caissier';
  const [ownAgencyId, setOwnAgencyId] = useState('');

  useEffect(() => {
    if (!isCommercial || agencyId || !user?.id) return;
    commercialsApi
      .list({ per_page: 100 })
      .then((res) => {
        const mine = (res.data ?? []).find((c) => c.user_id === user.id);
        if (mine?.agency_id) setOwnAgencyId(mine.agency_id);
      })
      .catch(() => {});
  }, [isCommercial, agencyId, user?.id]);

  useEffect(() => {
    if (!isCaissier || agencyId || !user?.assignments?.length) return;
    const primary = user.assignments.find((a) => a.pivot?.is_primary === true);
    const agency = primary ?? user.assignments[0];
    if (agency?.id) setOwnAgencyId(agency.id);
  }, [isCaissier, agencyId, user?.assignments]);

  const effectiveAgencyId = agencyId || ownAgencyId || undefined;
  const effectiveShowAcademyTabs =
    showAcademyTabs || Boolean(countryId) || ((isCommercial || isCaissier) && Boolean(effectiveAgencyId));

  // C4 : onglet Packages réservé aux rôles autorisés à vendre/souscrire.
  const showPackagesTab = canSubscribePackage(user);

  const servicesBase = agencyId
    ? countryId
      ? `/countries/${countryId}/agencies/${agencyId}/services`
      : `/agencies/${agencyId}/services`
    : countryId
      ? `/countries/${countryId}/services`
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

  const [promoService, setPromoService] = useState<Service | null>(null);
  const [promoEditing, setPromoEditing] = useState<Promotion | null>(null);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [packages, setPackages] = useState<AgencyPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [offers, setOffers] = useState<LaravelPage<PrestationOffer> | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<AgencyPackage | null>(null);
  const [offerSubscribeTarget, setOfferSubscribeTarget] = useState<PrestationOffer | null>(null);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageCategory, setPackageCategory] = useState('');
  const [packageAgency, setPackageAgency] = useState('');

  // Formations Academy (cours réels) affichées dans l'onglet « Formations » :
  // les Pages Produits (pays, agence, catalogue staff) montrent ainsi les
  // mêmes formations que /departments/:id/courses.
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null);

  const canSubscribe = canSubscribePackage(user) && !agencyId;

  // Clic sur une prestation du catalogue : le caissier / commercial souscrit
  // directement un client (formulaire) au lieu d'ouvrir la page département.
  function handleOfferOpen(offer: PrestationOffer) {
    if ((isCommercial || isCaissier) && canCreatePrestation(user)) {
      setOfferSubscribeTarget(offer);
      return;
    }
    if (offer.department_id) {
      navigate(`/departments/${offer.department_id}/prestations/${offer.id}/subscriptions`);
    }
  }

  const fetchPackages = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      // is_public concerne le portail client (PC1) : le catalogue staff affiche tous
      // les packages actifs du périmètre (agence de l'utilisateur quand elle est connue).
      const rows = await agencyDeptApi.packages({
        is_active: true,
        agency_id: effectiveAgencyId || undefined,
      });
      setPackages(rows);
    } catch (error) {
      setPackagesError(extractErrorMessage(error, t('services.loadFailed')));
    } finally {
      setPackagesLoading(false);
    }

    // Les prestations complètent l'affichage : un refus de permission (rôles sans
    // « prestations.consulter ») ne doit pas masquer les packages.
    try {
      setOffers(
        await agencyDeptApi.offers({
          agency_id: effectiveAgencyId || undefined,
          country_id: countryId,
          per_page: 100,
        }),
      );
    } catch {
      setOffers({ data: [], current_page: 1, last_page: 1, per_page: 100, total: 0 });
    }
  }, [effectiveAgencyId, countryId]);

  useEffect(() => {
    if (tab !== 'packages') return;
    fetchPackages();
  }, [tab, fetchPackages]);

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const res = await academyApi.courses({
        agency_id: effectiveAgencyId,
        country_id: countryId,
        per_page: 50,
      });
      setCourses(res.data ?? []);
    } catch {
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, [effectiveAgencyId, countryId]);

  useEffect(() => {
    if (tab !== 'formations' || !effectiveShowAcademyTabs) return;
    fetchCourses();
  }, [tab, effectiveShowAcademyTabs, fetchCourses]);
  const canPromoteService = ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'].includes(
    user?.role?.name ?? ''
  );

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
        type: tab === 'formations' ? 'formation' : tab === 'services' ? 'service' : undefined,
        is_seminar: tab === 'formations' ? true : tab === 'services' ? false : undefined,
      });
      setServices(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('services.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, agencyFilter, sortBy, sortOrder, page, tab]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchServices();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, agencyFilter, sortBy, sortOrder, tab]);

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
    return `${new Intl.NumberFormat(currentLocale()).format(Number(value))} ${currencyLabel()}`;
  }

  // Recherche locale dans l'onglet Packages (packs + prestations).
  const catalogQuery = packageSearch.trim().toLowerCase();

  // Options des filtres : dérivées des données chargées (packs + offres).
  const packageCategories = useMemo(() => {
    const names = new Set<string>();
    for (const p of packages) if (p.category?.name) names.add(p.category.name);
    if (offers) for (const o of offers.data) if (o.category?.name) names.add(o.category.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [packages, offers]);
  const packageAgencies = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of packages) if (p.agency) map.set(p.agency.id, p.agency.name);
    if (offers) for (const o of offers.data) if (o.agency) map.set(o.agency.id, o.agency.name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [packages, offers]);

  const filteredCatalogPackages = packages.filter((p) => {
    if (
      catalogQuery &&
      !(
        p.name.toLowerCase().includes(catalogQuery) ||
        (p.code ?? '').toLowerCase().includes(catalogQuery) ||
        (p.tagline ?? '').toLowerCase().includes(catalogQuery)
      )
    )
      return false;
    if (packageCategory && p.category?.name !== packageCategory) return false;
    if (packageAgency && p.agency_id !== packageAgency) return false;
    return true;
  });
  const filteredCatalogOffers =
    offers
      ? {
          ...offers,
          data: offers.data.filter((o) => {
            if (
              catalogQuery &&
              !(
                o.name.toLowerCase().includes(catalogQuery) ||
                (o.description ?? '').toLowerCase().includes(catalogQuery)
              )
            )
              return false;
            if (packageCategory && o.category?.name !== packageCategory) return false;
            if (packageAgency && o.agency_id !== packageAgency) return false;
            return true;
          }),
        }
      : offers;
  // Garde-fou : l'onglet « Produits » n'affiche jamais de formations, même si
  // l'API en retournait (une formation = is_seminar ou type formation).
  const visibleServices =
    tab === 'services'
      ? services.filter((s) => !s.is_seminar && (s as { type?: string }).type !== 'formation')
      : services;

  function formatCoursePrice(value: number | null | undefined): string {
    if (value == null) return '—';
    return `${new Intl.NumberFormat(currentLocale()).format(Number(value))} ${currencyLabel()}`;
  }

  function handlePromoSaved(saved: Promotion) {
    setServices((prev) =>
      prev.map((service) =>
        service.id === saved.service_id
          ? {
              ...service,
              effective_price: saved.effective_price ?? service.effective_price,
              promotions: [saved, ...(service.promotions ?? []).filter((p) => p.id !== saved.id)],
            }
          : service
      )
    );
  }

  const hasPromo = (service: Service) => Number(service.effective_price) !== Number(service.price);

  const activePromotion = (service: Service) =>
    (service.promotions ?? [])
      .filter((promotion) => promotion.is_active)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const toEditablePromotion = (
    promotion: NonNullable<Service['promotions']>[number] | undefined
  ): Promotion | null =>
    promotion
      ? {
          id: promotion.id,
          service_id: promotion.service_id,
          type: promotion.type ?? 'amount',
          promo_price: promotion.promo_price,
          discount_percent: promotion.discount_percent,
          effective_price: promotion.effective_price ?? null,
          start_date: promotion.start_date,
          end_date: promotion.end_date,
          is_active: promotion.is_active,
        }
      : null;

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

  if (tab === 'packages') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.packages')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.packages.subscribeHint')}</p>
          </div>
        </div>
        <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setTab('services')}
            className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
          >
            {t('nav.services')}
          </button>
          {effectiveShowAcademyTabs && (
            <button
              type="button"
              onClick={() => setTab('formations')}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('nav.academy')}
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-2 border-b-2 border-brand-500 px-4 py-2.5 text-sm font-medium text-brand-600 transition-colors dark:text-brand-400"
          >
            {t('nav.packages')}
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={packageSearch}
            onChange={(e) => setPackageSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        {(packageCategories.length > 0 || (!effectiveAgencyId && packageAgencies.length > 0)) && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {packageCategories.length > 0 && (
              <div className="sm:w-48">
                <Select
                  label={t('services.category')}
                  value={packageCategory}
                  onChange={(e) => setPackageCategory(e.target.value)}
                >
                  <option value="">{t('services.allCategories')}</option>
                  {packageCategories.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {!effectiveAgencyId && packageAgencies.length > 0 && (
              <div className="sm:w-48">
                <Select
                  label={t('services.agency')}
                  value={packageAgency}
                  onChange={(e) => setPackageAgency(e.target.value)}
                >
                  <option value="">{t('services.allAgencies')}</option>
                  {packageAgencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}
        {packagesLoading ? (
          <SkeletonCards />
        ) : packagesError ? (
          <p className="text-sm text-error-500">{packagesError}</p>
        ) : filteredCatalogPackages.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.packages.empty')}</p>
        ) : (
          groupPackagesByCategory(filteredCatalogPackages, t('agencyDept.packages.uncategorized')).map((group) => (
            <section key={group.name} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Tag className="h-4 w-4" /> {group.name}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {group.items.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    canManage={false}
                    canSubscribe={canSubscribe && pkg.is_active}
                    showAgency={!effectiveAgencyId}
                    onSubscribe={() => setSubscribeTarget(pkg)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Tag className="h-4 w-4" /> {t('nav.prestations')}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            {!filteredCatalogOffers ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
            ) : filteredCatalogOffers.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.offers.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('agencyDept.offers.offer')}</th>
                      {!effectiveAgencyId && <th className="px-4 py-3 font-medium">{t('agencyDept.agency')}</th>}
                      <th className="px-4 py-3 font-medium">{t('agencyDept.offers.subscriptions')}</th>
                      <th className="px-4 py-3 font-medium">{t('agencyDept.rating')}</th>
                      <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredCatalogOffers.data.map((o) => {
                      const count = o.subscriptions_count ?? 0;
                      const avg = o.subscriptions_rating_avg ? Number(o.subscriptions_rating_avg) : null;
                      const clickable = Boolean(o.department_id) || ((isCommercial || isCaissier) && canCreatePrestation(user));
                      return (
                        <tr
                          key={o.id}
                          className={clickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                          onClick={() => handleOfferOpen(o)}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900 dark:text-white">{o.name}</span>
                            <p className="text-xs text-gray-400">{o.category ? `${o.category.name} · ` : ''}{o.description ?? ''}</p>
                          </td>
                          {!effectiveAgencyId && <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{o.agency?.name ?? '—'}</td>}
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
        </section>

        {subscribeTarget && (
          <PackageSubscribeModal
            pkg={subscribeTarget}
            departmentId={undefined}
            onClose={() => setSubscribeTarget(null)}
            onDone={() => { setSubscribeTarget(null); fetchPackages(); }}
          />
        )}

        {offerSubscribeTarget && (
          <PrestationFormModal
            isOpen
            onClose={() => setOfferSubscribeTarget(null)}
            offer={offerSubscribeTarget}
            agencyId={effectiveAgencyId}
            countryId={countryId}
            onSaved={() => {
              setOfferSubscribeTarget(null);
              fetchPackages();
              showToast(t('agencyDept.saved'), 'success');
            }}
          />
        )}
      </div>
    );
  }

  if (effectiveShowAcademyTabs && tab === 'agency') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('agencyDept.catalog.title')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.catalog.subtitle')}</p>
          </div>
        </div>
        <CatalogTabs tab={tab} onChange={setTab} />
        <AgencyCatalogTab agencyId={effectiveAgencyId} countryId={countryId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('services.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setQuickSaleOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            {t('invoices.newSale')}
          </Button>
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

      {(effectiveShowAcademyTabs || showPackagesTab) && (
        <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setTab('services')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === 'services'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('nav.services')}
          </button>
          {effectiveShowAcademyTabs && (
            <button
              type="button"
              onClick={() => setTab('formations')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === 'formations'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('nav.academy')}
            </button>
          )}
          {showPackagesTab && (
            <button
              type="button"
              onClick={() => setTab('packages')}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('nav.packages')}
            </button>
          )}
        </div>
      )}

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

      {tab === 'formations' && effectiveShowAcademyTabs && (
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <GraduationCap className="h-4 w-4" /> {t('nav.academy')}
          </h2>
          {coursesLoading ? (
            <SkeletonCards />
          ) : courses.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
              {t('services.empty')}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  {course.cover_image ? (
                    <div
                      className="h-32 w-full shrink-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${course.cover_image})` }}
                      role="img"
                      aria-label={course.name}
                    />
                  ) : (
                    <div className="flex h-32 w-full shrink-0 items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40">
                      <GraduationCap className="h-8 w-8 text-purple-400" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{course.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {course.code}
                      {course.categories?.[0] ? ` · ${course.categories[0].name}` : ''}
                    </p>
                    {course.description && (
                      <p className="mt-3 line-clamp-2 flex-1 text-sm text-gray-500 dark:text-gray-400">
                        {course.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCoursePrice(course.effective_price ?? course.price)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                      <span className="inline-flex items-center gap-1.5 truncate text-sm text-gray-500 dark:text-gray-400">
                        <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{course.agency?.name ?? '—'}</span>
                      </span>
                      {canEnrollLearners(user) && (
                        <Button size="sm" variant="outline" onClick={() => setEnrollCourse(course)} title={t('academy.newEnrollment')}>
                          <UserPlus className="h-4 w-4" />
                          {t('academy.newEnrollment')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* En onglet Formations sans services de type formation : pas de bloc
          « Aucun service » sous les formations Academy. */}
      {!(tab === 'formations' && !isLoading && !loadError && visibleServices.length === 0) && (
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : visibleServices.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('services.empty')}</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleServices.map((service) => (
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
                      {canPromoteService && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPromoEditing(toEditablePromotion(activePromotion(service)));
                            setPromoService(service);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-600 dark:hover:bg-gray-800"
                          title={t('services.promote')}
                        >
                          <Tag className="h-4 w-4" />
                        </button>
                      )}
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
      )}

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

      <PromotionFormModal
        isOpen={Boolean(promoService) || Boolean(promoEditing)}
        service={promoService}
        editing={promoEditing}
        onClose={() => {
          setPromoService(null);
          setPromoEditing(null);
        }}
        onSaved={handlePromoSaved}
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

      <QuickSaleModal
        isOpen={quickSaleOpen}
        onClose={() => setQuickSaleOpen(false)}
        agencyId={effectiveAgencyId}
      />

      {enrollCourse && (
        <FormationEnrollmentModal
          isOpen={Boolean(enrollCourse)}
          onClose={() => setEnrollCourse(null)}
          agencyId={effectiveAgencyId}
          countryId={countryId}
          presetCourseId={enrollCourse.id}
          onSaved={() => {
            setEnrollCourse(null);
            fetchCourses();
          }}
        />
      )}
    </div>
  );
}

/** Onglets du catalogue : produits, Academy, Agency (pays / agence). */
type CatalogTab = 'services' | 'formations' | 'agency';

function CatalogTabs({ tab, onChange }: { tab: CatalogTab; onChange: (tab: CatalogTab) => void }) {
  const { t } = useTranslation();
  const tabs: { id: CatalogTab; label: string }[] = [
    { id: 'services', label: t('nav.services') },
    { id: 'formations', label: t('nav.academy') },
    { id: 'agency', label: t('nav.agency') },
  ];

  return (
    <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === item.id
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
