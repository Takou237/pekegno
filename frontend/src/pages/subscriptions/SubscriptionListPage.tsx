import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Download, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { subscriptionsApi } from '@/api/subscriptions.api';
import { agenciesApi } from '@/api/agencies.api';
import { clientsApi } from '@/api/clients.api';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { formatRelativeDate } from '@/utils/date';
import { canExportData } from '@/utils/exportPermissions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type {
  Subscription,
  SubscriptionPack,
  CreateSubscriptionPayload,
  SubscriptionPackPayload,
} from '@/types/subscription';
import type { Agency, PaginationMeta } from '@/types/agency';
import type { ServiceSearchItem } from '@/types/service';

export default function SubscriptionListPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [packs, setPacks] = useState<SubscriptionPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsMeta, setPacksMeta] = useState<PaginationMeta | null>(null);
  const [packsPage, setPacksPage] = useState(1);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showPacks, setShowPacks] = useState(false);

  const agencyId = fixedAgencyId ?? (searchParams.get('agency_id') ?? '');
  const clientId = searchParams.get('client_id') ?? '';

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );

  useEffect(() => {
    agenciesApi.list({ per_page: 100 }).then((res) => setAgencies(res.data ?? [])).catch(() => {});
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await subscriptionsApi.list({
        agency_id: agencyId || undefined,
        client_id: clientId || undefined,
        page,
        per_page: 15,
      });
      setSubscriptions(response.data ?? []);
      setMeta(response.meta ?? null);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('subscriptions.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, clientId, page, t]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const fetchPacks = useCallback(async () => {
    setPacksLoading(true);
    try {
      const response = await subscriptionsApi.packs({
        agency_id: agencyId || undefined,
        per_page: 15,
        page: packsPage,
      });
      setPacks(response.data ?? []);
      setPacksMeta(response.meta ?? null);
    } catch {
      showToast(t('subscriptions.packsLoadFailed'), 'error');
    } finally {
      setPacksLoading(false);
    }
  }, [agencyId, packsPage, showToast, t]);

  useEffect(() => {
    if (showPacks) fetchPacks();
  }, [showPacks, fetchPacks]);

  function setFilter(key: string, value: string) {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params, { replace: true });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('invoices');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await subscriptionsApi.remove(deleteTarget.id);
      showToast(t('subscriptions.deleted'), 'success');
      setDeleteTarget(null);
      fetchSubscriptions();
    } catch (error) {
      showToast(extractErrorMessage(error, t('subscriptions.deleteFailed')), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleRenew(sub: Subscription) {
    try {
      await subscriptionsApi.renew(sub.id);
      showToast(t('subscriptions.renewed'), 'success');
      fetchSubscriptions();
    } catch (error) {
      showToast(extractErrorMessage(error, t('subscriptions.renewFailed')), 'error');
    }
  }

  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subForm, setSubForm] = useState<CreateSubscriptionPayload>({
    subscription_pack_id: '',
    agency_id: fixedAgencyId ?? '',
    client_id: '',
    months: 1,
    advance: 0,
  });
  const [subFormErrors, setSubFormErrors] = useState<Record<string, string>>({});
  const [subFormSubmitting, setSubFormSubmitting] = useState(false);

  function openCreateSub() {
    setSubForm({
      subscription_pack_id: '',
      agency_id: fixedAgencyId ?? '',
      client_id: '',
      months: 1,
      advance: 0,
    });
    setSubFormErrors({});
    setSubFormOpen(true);
  }

  async function handleSubFormSubmit(event: FormEvent) {
    event.preventDefault();
    setSubFormSubmitting(true);
    setSubFormErrors({});
    try {
      await subscriptionsApi.create(subForm);
      showToast(t('subscriptions.created'), 'success');
      setSubFormOpen(false);
      fetchSubscriptions();
    } catch (error) {
      setSubFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('subscriptions.createFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setSubFormSubmitting(false);
    }
  }

  const [packFormOpen, setPackFormOpen] = useState(false);
  const [editPack, setEditPack] = useState<SubscriptionPack | null>(null);
  const [packForm, setPackForm] = useState<SubscriptionPackPayload>({
    agency_id: fixedAgencyId ?? '',
    name: '',
    description: '',
    price_per_month: 0,
    is_active: true,
    services: [],
  });
  const [packFormErrors, setPackFormErrors] = useState<Record<string, string>>({});
  const [packFormSubmitting, setPackFormSubmitting] = useState(false);
  const [packDeleteTarget, setPackDeleteTarget] = useState<SubscriptionPack | null>(null);
  const [packDeleteSubmitting, setPackDeleteSubmitting] = useState(false);

  function openCreatePack() {
    setEditPack(null);
    setPackForm({
      agency_id: fixedAgencyId ?? '',
      name: '',
      description: '',
      price_per_month: 0,
      is_active: true,
      services: [],
    });
    setPackFormErrors({});
    setPackFormOpen(true);
  }

  function openEditPack(pack: SubscriptionPack) {
    setEditPack(pack);
    setPackForm({
      agency_id: pack.agency_id,
      name: pack.name,
      description: pack.description ?? '',
      price_per_month: Number(pack.price_per_month),
      is_active: pack.is_active,
      services: (pack.pack_services ?? []).map((ps) => ({
        service_id: ps.service_id,
      })),
    });
    setPackFormErrors({});
    setPackFormOpen(true);
  }

  async function handlePackFormSubmit(event: FormEvent) {
    event.preventDefault();
    setPackFormSubmitting(true);
    setPackFormErrors({});
    try {
      if (editPack) {
        await subscriptionsApi.updatePack(editPack.id, packForm);
        showToast(t('subscriptions.packUpdated'), 'success');
      } else {
        await subscriptionsApi.createPack(packForm);
        showToast(t('subscriptions.packCreated'), 'success');
      }
      setPackFormOpen(false);
      fetchPacks();
    } catch (error) {
      setPackFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, editPack ? t('subscriptions.packUpdateFailed') : t('subscriptions.packCreateFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setPackFormSubmitting(false);
    }
  }

  async function handlePackDelete() {
    if (!packDeleteTarget) return;
    setPackDeleteSubmitting(true);
    try {
      await subscriptionsApi.removePack(packDeleteTarget.id);
      showToast(t('subscriptions.packDeleted'), 'success');
      setPackDeleteTarget(null);
      fetchPacks();
    } catch (error) {
      showToast(extractErrorMessage(error, t('subscriptions.packDeleteFailed')), 'error');
    } finally {
      setPackDeleteSubmitting(false);
    }
  }

  function addPackService() {
    setPackForm((prev) => ({
      ...prev,
      services: [...(prev.services ?? []), { service_id: '' }],
    }));
  }

  function updatePackService(index: number, value: string) {
    setPackForm((prev) => ({
      ...prev,
      services: (prev.services ?? []).map((ps, i) =>
        i === index ? { ...ps, service_id: value } : ps
      ),
    }));
  }

  function removePackService(index: number) {
    setPackForm((prev) => ({
      ...prev,
      services: (prev.services ?? []).filter((_, i) => i !== index),
    }));
  }

  const statusLabel = (sub: Subscription): string => {
    const now = new Date();
    const end = new Date(sub.end_date);
    if (end < now) return t('subscriptions.statusExpired');
    return t('subscriptions.statusActive');
  };

  const statusVariant = (sub: Subscription): 'success' | 'error' => {
    const now = new Date();
    const end = new Date(sub.end_date);
    return end < now ? 'error' : 'success';
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('subscriptions.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('subscriptions.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canExportData(currentUser) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('subscriptions.export')}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowPacks(!showPacks)}>
            <Pencil className="h-4 w-4" />
            {showPacks ? t('subscriptions.hidePacks') : t('subscriptions.managePacks')}
          </Button>
          {canManage && (
            <Button onClick={openCreateSub}>
              <Plus className="h-4 w-4" />
              {t('subscriptions.newSubscription')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="w-48">
          {!fixedAgencyId && (
            <Select label={t('subscriptions.filterAgency')} value={agencyId} onChange={(e) => setFilter('agency_id', e.target.value)}>
              <option value="">{t('common.selectAllAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Autocomplete
            label={t('subscriptions.filterClient')}
            placeholder={t('subscriptions.filterClientPlaceholder')}
            value={clientId}
            onChange={(id) => setFilter('client_id', id)}
            fetchOptions={async (query) => {
              const res = await clientsApi.search(query.trim());
              return res.map((c) => ({
                id: c.id,
                label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                subtitle: c.email,
              }));
            }}
          />
        </div>
      </div>

      {showPacks && (
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('subscriptions.packsTitle')}</h2>
            {canManage && (
              <Button onClick={openCreatePack}>
                <Plus className="h-4 w-4" />
                {t('subscriptions.newPack')}
              </Button>
            )}
          </div>
          {packsLoading ? (
            <SkeletonTable />
          ) : packs.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('subscriptions.packsEmpty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('subscriptions.packName')}</th>
                    <th className="px-5 py-3 font-medium">{t('subscriptions.packDescription')}</th>
                    <th className="px-5 py-3 text-right font-medium">{t('subscriptions.packPricePerMonth')}</th>
                    <th className="px-5 py-3 font-medium">{t('subscriptions.packServices')}</th>
                    <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                    {canManage && (
                      <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {packs.map((pack) => (
                    <tr key={pack.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                        {pack.name}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {pack.description ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(Number(pack.price_per_month))}/mo
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {pack.pack_services?.map((ps) => (
                          <span key={ps.id} className="mr-2 inline-flex items-center gap-1 text-xs">
                            {ps.service?.name ?? ps.service_id}
                          </span>
                        ))}
                      </td>
                      <td className="px-5 py-3">
                        {pack.is_active ? (
                          <Badge variant="success">{t('common.active')}</Badge>
                        ) : (
                          <Badge variant="error">{t('common.inactive')}</Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditPack(pack)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPackDeleteTarget(pack)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {packsMeta && packsMeta.last_page > 1 && (
            <div className="border-t border-gray-100 p-4 dark:border-gray-800">
              <Pagination
                currentPage={packsMeta.current_page}
                lastPage={packsMeta.last_page}
                total={packsMeta.total}
                perPage={packsMeta.per_page}
                onPageChange={setPacksPage}
              />
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : subscriptions.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('subscriptions.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('subscriptions.colClient')}</th>
                  <th className="px-5 py-3 font-medium">{t('subscriptions.colPack')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('subscriptions.colMonths')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('subscriptions.colTotalPrice')}</th>
                  <th className="px-5 py-3 font-medium">{t('subscriptions.colStartDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('subscriptions.colEndDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('subscriptions.colStatus')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-800 dark:text-gray-100">
                      {sub.client
                        ? [sub.client.first_name, sub.client.last_name].filter(Boolean).join(' ') || sub.client.email
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {sub.pack?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {sub.months}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(Number(sub.total_price))}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatRelativeDate(sub.start_date)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatRelativeDate(sub.end_date)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant(sub)}>{statusLabel(sub)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleRenew(sub)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title={t('subscriptions.renew')}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(sub)}
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

      <Modal
        isOpen={subFormOpen}
        onClose={() => setSubFormOpen(false)}
        title={t('subscriptions.createSubscriptionTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubFormSubmit} className="flex flex-col gap-4">
          {Object.keys(subFormErrors).length > 0 && (
            <Alert variant="error">{Object.values(subFormErrors).join(' ')}</Alert>
          )}
          <div className="min-w-0">
            <Autocomplete
              label={t('subscriptions.formClient')}
              placeholder={t('subscriptions.formClientPlaceholder')}
              value={subForm.client_id}
              onChange={(id) => setSubForm((prev) => ({ ...prev, client_id: id }))}
              fetchOptions={async (query) => {
                const res = await clientsApi.search(query.trim());
                return res.map((c) => ({
                  id: c.id,
                  label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                  subtitle: c.email,
                }));
              }}
              error={subFormErrors.client_id}
            />
          </div>
          {!fixedAgencyId && (
            <Select
              label={t('subscriptions.formAgency')}
              value={subForm.agency_id}
              onChange={(e) => setSubForm((prev) => ({ ...prev, agency_id: e.target.value }))}
              error={subFormErrors.agency_id}
            >
              <option value="">{t('subscriptions.formSelectAgency')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            label={t('subscriptions.formPack')}
            value={subForm.subscription_pack_id}
            onChange={(e) => setSubForm((prev) => ({ ...prev, subscription_pack_id: e.target.value }))}
            error={subFormErrors.subscription_pack_id}
          >
            <option value="">{t('subscriptions.formSelectPack')}</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input
            label={t('subscriptions.formMonths')}
            type="number"
            min={1}
            required
            value={subForm.months}
            onChange={(e) => setSubForm((prev) => ({ ...prev, months: Number(e.target.value) }))}
            error={subFormErrors.months}
          />
          <Input
            label={t('subscriptions.formAdvance')}
            type="number"
            min={0}
            value={subForm.advance ?? 0}
            onChange={(e) => setSubForm((prev) => ({ ...prev, advance: Number(e.target.value) }))}
            error={subFormErrors.advance}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setSubFormOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={subFormSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={packFormOpen}
        onClose={() => setPackFormOpen(false)}
        title={editPack ? t('subscriptions.editPackTitle') : t('subscriptions.createPackTitle')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handlePackFormSubmit} className="flex flex-col gap-4">
          {Object.keys(packFormErrors).length > 0 && (
            <Alert variant="error">{Object.values(packFormErrors).join(' ')}</Alert>
          )}
          {!fixedAgencyId && (
            <Select
              label={t('subscriptions.formAgency')}
              value={packForm.agency_id}
              onChange={(e) => setPackForm((prev) => ({ ...prev, agency_id: e.target.value }))}
              error={packFormErrors.agency_id}
            >
              <option value="">{t('subscriptions.formSelectAgency')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            label={t('subscriptions.packFormName')}
            required
            value={packForm.name}
            onChange={(e) => setPackForm((prev) => ({ ...prev, name: e.target.value }))}
            error={packFormErrors.name}
          />
          <Input
            label={t('subscriptions.packFormDescription')}
            value={packForm.description ?? ''}
            onChange={(e) => setPackForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <Input
            label={t('subscriptions.packFormPricePerMonth')}
            type="number"
            min={0}
            step="0.01"
            required
            value={packForm.price_per_month}
            onChange={(e) => setPackForm((prev) => ({ ...prev, price_per_month: Number(e.target.value) }))}
            error={packFormErrors.price_per_month}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('subscriptions.packFormServices')}
            </label>
            <div className="flex flex-col gap-2">
              {(packForm.services ?? []).map((ps, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Autocomplete
                      value={ps.service_id}
                      onChange={(id) => updatePackService(index, id)}
                      fetchOptions={async (query) => {
                        const res = await servicesApi.search(query.trim());
                        return res.map((s: ServiceSearchItem) => ({
                          id: s.id,
                          label: s.name,
                          subtitle: formatCurrency(Number(s.effective_price)),
                        }));
                      }}
                      placeholder={t('subscriptions.packFormSearchService')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePackService(index)}
                    className="mb-0.5 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addPackService}>
                <Plus className="h-4 w-4" />
                {t('subscriptions.packFormAddService')}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pack_is_active"
              checked={packForm.is_active ?? true}
              onChange={(e) => setPackForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="pack_is_active" className="text-sm text-gray-700 dark:text-gray-300">
              {t('subscriptions.packFormIsActive')}
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPackFormOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={packFormSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('subscriptions.deleteTitle')}
        message={
          deleteTarget
            ? t('subscriptions.deleteMessage', { id: deleteTarget.id })
            : ''
        }
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(packDeleteTarget)}
        title={t('subscriptions.packDeleteTitle')}
        message={
          packDeleteTarget
            ? t('subscriptions.packDeleteMessage', { name: packDeleteTarget.name })
            : ''
        }
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={packDeleteSubmitting}
        onConfirm={handlePackDelete}
        onCancel={() => setPackDeleteTarget(null)}
      />
    </div>
  );
}
