import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Users, ShieldCheck, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { departmentsApi } from '@/api/departments.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { canCreateDepartment, canManageDepartmentTrash } from '@/utils/departmentPermissions';
import type { Department, DepartmentPayload } from '@/types/department';
import type { Agency, PaginationMeta } from '@/types/agency';

interface DepartmentListPageProps {
  agencyId?: string;
}

export default function DepartmentListPage({ agencyId }: DepartmentListPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState(agencyId ?? '');
  const [page, setPage] = useState(1);

  const [formModal, setFormModal] = useState<{
    open: boolean;
    editing: Department | null;
  }>({ open: false, editing: null });
  const [form, setForm] = useState<DepartmentPayload>({
    agency_id: '',
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await departmentsApi.list({
        search: search || undefined,
        agency_id: agencyFilter || undefined,
        page,
        per_page: 15,
      });
      setDepartments(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('departments.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, agencyFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchDepartments();
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, agencyFilter]);

  useEffect(() => {
    fetchDepartments();
  }, [page]);

  useEffect(() => {
    agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setForm({ agency_id: agencyId ?? agencies[0]?.id ?? '', name: '', description: '' });
    setFormErrors({});
    setFormModal({ open: true, editing: null });
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    try {
      if (formModal.editing) {
        await departmentsApi.update(formModal.editing.id, form);
        showToast(t('departments.updated'), 'success');
      } else {
        await departmentsApi.create(form);
        showToast(t('departments.created'), 'success');
      }
      setFormModal({ open: false, editing: null });
      fetchDepartments();
    } catch (error) {
      setFormErrors(
        Object.fromEntries(
          Object.entries(
            (error as any).response?.data?.errors ?? {}
          ).map(([k, v]: [string, any]) => [k, v[0]])
        )
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('departments.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('departments.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {canManageDepartmentTrash(user) && (
            <Link to={agencyId ? `/agencies/${agencyId}/departments/trash` : '/departments/trash'}>
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                {t('common.trash')}
              </Button>
            </Link>
          )}
          {canCreateDepartment(user) && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('departments.newDepartment')}
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
              placeholder={t('departments.searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        {!agencyId && user?.role?.name !== 'responsable-departement' && (
          <div className="sm:w-64">
            <Select
              label={t('departments.agency')}
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
            >
              <option value="">{t('common.selectAllAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : departments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('departments.empty')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                onClick={() =>
                  navigate(`/departments/${dept.id}`, {
                    state: {
                      from: agencyId ? `/agencies/${agencyId}/departments` : '/departments',
                    },
                  })
                }
                className="group flex cursor-pointer flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    {dept.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{dept.name}</p>
                    {!agencyId && (
                      <p className="truncate text-xs text-gray-400">{dept.agency?.name ?? '—'}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <div className="flex min-w-0 items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <span
                      className="inline-flex items-center gap-1.5"
                      title={t('departments.colChief')}
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{dept.department_chief?.name ?? '—'}</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5"
                      title={t('departments.colCount')}
                    >
                      <Users className="h-4 w-4 shrink-0 text-gray-400" />
                      {dept.user_count ?? 0}
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
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

      {/* Modal création / édition */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, editing: null })}
        title={formModal.editing ? t('departments.editTitle') : t('departments.createTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && (
            <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
          )}
          <Select
            label={t('departments.agency')}
            required
            value={form.agency_id}
            onChange={(e) => setForm((p) => ({ ...p, agency_id: e.target.value }))}
            error={formErrors.agency_id}
          >
            <option value="">{t('departments.selectAgency')}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
          <Input
            label={t('departments.colName')}
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            error={formErrors.name}
          />
          <Input
            label={t('departments.description')}
            value={form.description ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormModal({ open: false, editing: null })}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={formSubmitting} className="flex-1">
              {formModal.editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
