import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, ArrowUpDown, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AgencyFormModal } from '@/components/agencies/AgencyFormModal';
import { AgencyDetailModal } from '@/components/agencies/AgencyDetailModal';
import { AgencyChiefAssignModal } from '@/components/agencies/AgencyChiefAssignModal';
import { canAssignAgencyChief, canCreateAgency, canDeleteAgency, canEditAgency, canManageTrash } from '@/utils/agencyPermissions';
import type { Agency, AgencyListParams, PaginationMeta } from '@/types/agency';

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

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [sortBy, setSortBy] = useState<NonNullable<AgencyListParams['sort_by']>>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<{ open: boolean; agency: Agency | null }>({
    open: false,
    agency: null,
  });
  const [detailAgency, setDetailAgency] = useState<Agency | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agency | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chiefAgency, setChiefAgency] = useState<Agency | null>(null);

  const fetchAgencies = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await agenciesApi.list({
        search: search || undefined,
        country: country || undefined,
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
  }, [search, country, sortBy, sortOrder, page]);

  // Debounce léger sur la recherche texte pour éviter un appel par frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchAgencies();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, country, sortBy, sortOrder]);

  useEffect(() => {
    fetchAgencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await agenciesApi.remove(deleteTarget.id);
      showToast(t('agencies.archived'), 'success');
      setDeleteTarget(null);
      fetchAgencies();
    } catch (error) {
      showToast(
        extractErrorMessage(error, t('agencies.deleteFailed')),
        'error'
      );
    } finally {
      setIsDeleting(false);
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
          {canManageTrash(user) && (
            <Link to="/agencies/trash">
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                {t('common.trash')}
              </Button>
            </Link>
          )}
          {canCreateAgency(user) && (
            <div className="w-48">
              <Button onClick={() => setFormModalState({ open: true, agency: null })}>
                <Plus className="h-4 w-4" />
                {t('agencies.newAgency')}
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

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : agencies.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('agencies.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('agencies.colCode')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencies.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencies.colCountryCity')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencies.colContact')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencies.colDepartments')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {agencies.map((agency) => (
                  <tr key={agency.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{agency.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {agency.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {agency.country}
                      {agency.city ? `, ${agency.city}` : ''}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {agency.email ?? agency.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {agency.departments.length}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailAgency(agency)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canAssignAgencyChief(user) && (
                          <button
                            type="button"
                            onClick={() => setChiefAgency(agency)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-600 dark:hover:bg-gray-800"
                            title={t('agencies.assignChief')}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                        {canEditAgency(user) && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate(`/users?agency_id=${agency.id}`)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-purple-600 dark:hover:bg-gray-800"
                              title={t('agencies.viewDepartments')}
                            >
                              <Users className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormModalState({ open: true, agency })}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canDeleteAgency(user) && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(agency)}
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

      <AgencyFormModal
        isOpen={formModalState.open}
        agency={formModalState.agency}
        onClose={() => setFormModalState({ open: false, agency: null })}
        onSaved={handleSaved}
      />

      <AgencyDetailModal agency={detailAgency} onClose={() => setDetailAgency(null)} />

      <AgencyChiefAssignModal
        isOpen={Boolean(chiefAgency)}
        agency={chiefAgency}
        onClose={() => setChiefAgency(null)}
        onSaved={fetchAgencies}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('agencies.archiveTitle')}
        message={t('agencies.archiveMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('agencies.archive')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
