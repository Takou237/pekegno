import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  ArrowUpDown,
  MapPin,
  Phone,
  Mail,
  FolderTree,
  ArrowRight,
  Download,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { AgencyFormModal } from '@/components/agencies/AgencyFormModal';
import { canCreateAgency, canManageTrash } from '@/utils/agencyPermissions';
import { canExportData } from '@/utils/exportPermissions';
import type { Agency, AgencyListParams, PaginationMeta } from '@/types/agency';
import type { CountryStat } from '@/types/stats';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

function getSortOptions(t: TranslateFn): { value: NonNullable<AgencyListParams['sort_by']>; label: string }[] {
  return [
    { value: 'name', label: t('agencies.sortName') },
    { value: 'code', label: t('agencies.sortCode') },
    { value: 'country', label: t('agencies.sortCountry') },
    { value: 'created_at', label: t('agencies.sortCreatedAt') },
  ];
}

export default function AgencyListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { countryId } = useParams<{ countryId?: string }>();
  const outletContext = useOutletContext<{ country?: CountryStat | null } | undefined>();
  const contextCountry = countryId ? outletContext?.country ?? null : null;

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [typeFilter, setTypeFilter] = useState<NonNullable<AgencyListParams['type']> | ''>('');
  const [sortBy, setSortBy] = useState<NonNullable<AgencyListParams['sort_by']>>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<{ open: boolean; agency: Agency | null }>({
    open: false,
    agency: null,
  });

  const fetchAgencies = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await agenciesApi.list({
        search: search || undefined,
        country: country || undefined,
        country_id: countryId || undefined,
        type: typeFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: 15,
      });
      setAgencies(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('agencies.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, country, countryId, typeFilter, sortBy, sortOrder, page]);

  // Debounce léger sur la recherche texte pour éviter un appel par frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchAgencies();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, country, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchAgencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  function openAgency(agency: Agency) {
    const country = countryId ?? agency.country_id;
    navigate(country ? `/countries/${country}/agencies/${agency.id}` : `/agencies/${agency.id}`);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('agencies');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  function handleSaved(saved: Agency) {
    setAgencies((prev) => {
      const exists = prev.some((agency) => agency.id === saved.id);
      return exists
        ? prev.map((agency) => (agency.id === saved.id ? saved : agency))
        : [saved, ...prev];
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('agencies.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('agencies.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {canExportData(user) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('agencies.export')}
            </Button>
          )}
          {canManageTrash(user) && (
            <Link to={countryId ? `/countries/${countryId}/agencies/trash` : '/agencies/trash'}>
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                {t('common.trash')}
              </Button>
            </Link>
          )}
          {canCreateAgency(user) && (
            <Button onClick={() => setFormModalState({ open: true, agency: null })}>
              <Plus className="h-4 w-4" />
              {t('agencies.newAgency')}
            </Button>
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
              placeholder={t('agencies.searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <Input
            label={t('agencies.country')}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t('agencies.countryPlaceholder')}
          />
        </div>
        <div className="sm:w-48">
          <Select
            label={t('agencies.filterType')}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="">{t('agencies.filterTypeAll')}</option>
            <option value="agency">{t('agencies.filterTypeAgency')}</option>
            <option value="academy">{t('agencies.filterTypeAcademy')}</option>
            <option value="mixed">{t('agencies.filterTypeMixed')}</option>
          </Select>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('agencies.sortBy')}
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

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : agencies.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('agencies.empty')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agencies.map((agency) => (
              <div
                key={agency.id}
                onClick={() => openAgency(agency)}
                className="group flex cursor-pointer flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    {agency.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{agency.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs text-gray-400">{agency.code}</p>
                      {agency.activities && agency.activities.length > 0 ? (
                        agency.activities
                          .filter((a) => a.is_active)
                          .map((a) => (
                            <Badge key={a.type} variant={a.type === 'academy' ? 'brand' : 'success'}>
                              {a.type === 'academy' ? t('agencies.filterTypeAcademy') : t('agencies.filterTypeAgency')}
                            </Badge>
                          ))
                      ) : (
                        agency.type && (
                          <Badge
                            variant={
                              agency.type === 'academy'
                                ? 'brand'
                                : agency.type === 'mixed'
                                  ? 'warning'
                                  : 'success'
                            }
                          >
                            {agency.type === 'academy'
                              ? t('agencies.filterTypeAcademy')
                              : agency.type === 'mixed'
                                ? t('agencies.filterTypeMixed')
                                : t('agencies.filterTypeAgency')}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                    {agency.country}
                    {agency.city ? `, ${agency.city}` : ''}
                  </span>
                  {agency.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                      {agency.phone}
                    </span>
                  )}
                  {agency.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{agency.email}</span>
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <FolderTree className="h-4 w-4" />
                    {agency.departments.length} {t('agencies.colDepartments').toLowerCase()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                    {t('agencies.open')}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
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

      <AgencyFormModal
        isOpen={formModalState.open}
        agency={formModalState.agency}
        defaultCountry={contextCountry ? { id: contextCountry.id, name: contextCountry.name } : null}
        onClose={() => setFormModalState({ open: false, agency: null })}
        onSaved={handleSaved}
      />
    </div>
  );
}
