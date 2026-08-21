import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Pencil, Eye, Trash2, UserPlus, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { canExportData } from '@/utils/exportPermissions';
import type { ClientListItem } from '@/types/client';
import type { PaginationMeta } from '@/types/agency';

interface ClientForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  password: string;
  is_active: boolean;
}

const EMPTY_FORM: ClientForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  address: '',
  password: '',
  is_active: true,
};

export default function ClientListPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { countryId } = useParams<{ countryId?: string }>();

  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [viewClient, setViewClient] = useState<ClientListItem | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientListItem | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClientListItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchParams = useMemo(
    () => ({ search: search || undefined, page }),
    [search, page]
  );

  async function fetchClients() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await clientsApi.list({ ...fetchParams, per_page: 15 });
      setClients(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('clients.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  function openCreate() {
    setEditClient(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(client: ClientListItem) {
    setEditClient(client);
    setForm({
      first_name: client.first_name ?? '',
      last_name: client.last_name ?? '',
      email: client.email,
      phone: client.phone ?? '',
      city: client.city ?? '',
      country: client.country ?? '',
      address: client.address ?? '',
      password: '',
      is_active: client.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    try {
      if (editClient) {
        const payload = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          city: form.city,
          country: form.country,
          address: form.address,
          is_active: form.is_active,
        };
        await clientsApi.update(editClient.id, payload);
        showToast(t('clients.updated'), 'success');
      } else {
        const pwd = form.password || '12345678';
        const payload = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          city: form.city,
          country: form.country,
          address: form.address,
          password: pwd,
          password_confirmation: pwd,
          is_active: form.is_active,
        };
        await clientsApi.create(payload);
        showToast(t('clients.created'), 'success');
      }
      setFormOpen(false);
      fetchClients();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('clients.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await clientsApi.remove(deleteTarget.id);
      showToast(t('clients.deleted'), 'success');
      setDeleteTarget(null);
      fetchClients();
    } catch (error) {
      showToast(extractErrorMessage(error, t('clients.deleteBlocked')), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('clients');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('clients.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('clients.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {canExportData(currentUser) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('clients.export')}
            </Button>
          )}
          {canManage && (
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              {t('clients.createClient')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clients.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('clients.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('clients.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colEmail')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colPhone')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colCity')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-xs font-medium text-gray-400">
                      {c.client_number ?? '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {c.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{c.email}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.city ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {c.is_active ? (
                        <Badge variant="success">{t('common.active')}</Badge>
                      ) : (
                        <Badge variant="error">{t('common.inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {canManage && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                countryId
                                  ? `/countries/${countryId}/clients/${c.id}`
                                  : `/clients/${c.id}`,
                              )
                            }
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title={t('clients.detail')}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
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
                      )}
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

      <Modal
        isOpen={Boolean(viewClient)}
        onClose={() => setViewClient(null)}
        title={t('clients.detailTitle')}
        maxWidth="max-w-md"
      >
        {viewClient && (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colNumber')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.client_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colName')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colEmail')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colPhone')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.city')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.city ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.country')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.country ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.address')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('common.status')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">
                {viewClient.is_active ? t('common.active') : t('common.inactive')}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editClient ? t('clients.editTitle') : t('clients.createTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && (
            <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('clients.firstName')}
              name="first_name"
              required
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
              error={formErrors.first_name}
            />
            <Input
              label={t('clients.lastName')}
              name="last_name"
              required
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
              error={formErrors.last_name}
            />
          </div>
          <Input
            label={t('clients.email')}
            type="email"
            name="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            error={formErrors.email}
          />
          <Input
            label={t('clients.phone')}
            type="tel"
            name="phone"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            error={formErrors.phone}
            placeholder="+237 6XX XXX XXX"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('clients.city')}
              name="city"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              error={formErrors.city}
            />
            <Input
              label={t('clients.country')}
              name="country"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              error={formErrors.country}
            />
          </div>
          <Input
            label={t('clients.address')}
            name="address"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            error={formErrors.address}
            placeholder={t('clients.addressPlaceholder')}
          />
          {!editClient && (
            <Input
              label={t('clients.password')}
              type="password"
              name="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              error={formErrors.password}
              hint={t('clients.passwordHint')}
            />
          )}
          <Checkbox
            label={t('clients.isActive')}
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={formSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('clients.deleteTitle')}
        message={deleteTarget ? t('clients.deleteMessage', { name: deleteTarget.name }) : ''}
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
