import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Building2, Trash2, Edit, Search, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { companiesApi } from '@/api/companies.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Company, CompanyPayload } from '@/types/company';
import type { PaginationMeta } from '@/types/agency';

interface CompanyForm {
  name: string;
  industry: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  website: string;
  address: string;
}

const EMPTY_FORM: CompanyForm = {
  name: '',
  industry: '',
  phone: '',
  email: '',
  city: '',
  country: '',
  website: '',
  address: '',
};

export default function CompanyListPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchParams = useMemo(
    () => ({ search: search || undefined, page, per_page: 15 }),
    [search, page]
  );

  async function fetchCompanies() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await companiesApi.list(fetchParams);
      const body = response.data;
      setCompanies(body.data);
      setMeta({
        current_page: body.current_page,
        last_page: body.last_page,
        per_page: body.per_page,
        total: body.total,
      });
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('companies.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  function openCreate() {
    setEditCompany(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(company: Company) {
    setEditCompany(company);
    setForm({
      name: company.name ?? '',
      industry: company.industry ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      city: company.city ?? '',
      country: company.country ?? '',
      website: company.website ?? '',
      address: company.address ?? '',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function buildPayload(): CompanyPayload {
    return {
      name: form.name,
      ...(form.industry && { industry: form.industry }),
      ...(form.phone && { phone: form.phone }),
      ...(form.email && { email: form.email }),
      ...(form.city && { city: form.city }),
      ...(form.country && { country: form.country }),
      ...(form.website && { website: form.website }),
      ...(form.address && { address: form.address }),
    };
  }

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    try {
      if (editCompany) {
        await companiesApi.update(editCompany.id, buildPayload());
        showToast(t('companies.updated'), 'success');
      } else {
        await companiesApi.create(buildPayload());
        showToast(t('companies.created'), 'success');
      }
      setFormOpen(false);
      fetchCompanies();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('companies.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await companiesApi.remove(deleteTarget.id);
      showToast(t('companies.deleted'), 'success');
      setDeleteTarget(null);
      fetchCompanies();
    } catch (error) {
      showToast(extractErrorMessage(error, t('companies.deleteFailed')), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('companies.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('companies.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchCompanies} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('companies.newCompany')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('companies.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : companies.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('companies.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('companies.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('companies.colIndustry')}</th>
                  <th className="px-5 py-3 font-medium">{t('companies.colCity')}</th>
                  <th className="px-5 py-3 font-medium">{t('companies.colPhone')}</th>
                  <th className="px-5 py-3 font-medium">{t('companies.colProspects')}</th>
                  <th className="px-5 py-3 font-medium">{t('companies.colOpportunities')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                        {c.name}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.industry ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.city ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.prospects_count ?? 0}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.opportunities_count ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editCompany ? t('companies.editTitle') : t('companies.createTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && (
            <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
          )}
          <Input
            label={t('companies.fieldName')}
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            error={formErrors.name}
          />
          <Input
            label={t('companies.fieldIndustry')}
            name="industry"
            value={form.industry}
            onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
            error={formErrors.industry}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('companies.fieldPhone')}
              type="tel"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              error={formErrors.phone}
              placeholder="+237 6XX XXX XXX"
            />
            <Input
              label={t('companies.fieldEmail')}
              type="email"
              name="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              error={formErrors.email}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('companies.fieldCity')}
              name="city"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              error={formErrors.city}
            />
            <Input
              label={t('companies.fieldCountry')}
              name="country"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              error={formErrors.country}
            />
          </div>
          <Input
            label={t('companies.fieldWebsite')}
            type="url"
            name="website"
            value={form.website}
            onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
            error={formErrors.website}
            placeholder="https://..."
          />
          <Input
            label={t('companies.fieldAddress')}
            name="address"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            error={formErrors.address}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={formSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('companies.deleteTitle')}
        message={deleteTarget ? t('companies.deleteMessage', { name: deleteTarget.name }) : ''}
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
