import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Pencil, Trash2, Megaphone } from 'lucide-react';
import { adCampaignsApi } from '@/api/adCampaigns.api';
import { scopeApi, type ScopeCountry } from '@/api/scope.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { currentLocale } from '@/i18n';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { PaginationMeta } from '@/types/agency';
import type {
  AdCampaign,
  AdCampaignBranch,
  AdCampaignStatus,
} from '@/types/adCampaign';

/**
 * T3.8-T3.11 — Publicité Pekegno.
 *
 * Campagne locale : imputée à l'agence ciblée (100 % du budget).
 * Campagne nationale : répartie au prorata du CA de la branche par agence.
 */

const BRANCHES: AdCampaignBranch[] = ['academy', 'agency', 'store', 'studio'];
const STATUSES: AdCampaignStatus[] = ['draft', 'active', 'completed', 'cancelled'];

/** Rôles rattachés à une agence : la campagne nationale est gérée par l'administration. */
const AGENCY_SCOPED_ROLES = ['responsable-agence', 'responsable-departement'];

const STATUS_BADGES: Record<AdCampaignStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

interface FormState {
  name: string;
  branch: AdCampaignBranch;
  scope: 'local' | 'national';
  country_id: string;
  agency_id: string;
  budget: string;
  start_date: string;
  end_date: string;
  status: AdCampaignStatus;
  description: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inOneMonth(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    name: '',
    branch: 'store',
    scope: 'local',
    country_id: '',
    agency_id: '',
    budget: '',
    start_date: today(),
    end_date: inOneMonth(),
    status: 'active',
    description: '',
  };
}

export default function AdCampaignsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canCreateNational = !AGENCY_SCOPED_ROLES.includes(user?.role?.name ?? '');

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<AdCampaignStatus | ''>('');
  const [filterScope, setFilterScope] = useState<'' | 'local' | 'national'>('');
  const [filterBranch, setFilterBranch] = useState<'' | AdCampaignBranch>('');
  const [filterSearch, setFilterSearch] = useState('');

  const [scopeCountries, setScopeCountries] = useState<ScopeCountry[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdCampaign | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [deleting, setDeleting] = useState<AdCampaign | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adCampaignsApi
      .list({
        status: filterStatus || undefined,
        branch: filterBranch || undefined,
        is_national: filterScope === '' ? undefined : filterScope === 'national',
        search: filterSearch || undefined,
        page,
        per_page: 15,
      })
      .then((res) => {
        setCampaigns(res.data);
        setMeta({
          current_page: res.current_page,
          last_page: res.last_page,
          total: res.total,
          per_page: res.per_page,
        });
      })
      .catch((error) => showToast(extractErrorMessage(error, t('common.error')), 'error'))
      .finally(() => setLoading(false));
  }, [filterStatus, filterBranch, filterScope, filterSearch, page, showToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    scopeApi
      .getContext()
      .then((ctx) => setScopeCountries(ctx.countries))
      .catch(() => setScopeCountries([]));
  }, []);

  const selectedCountry = scopeCountries.find((c) => c.id === form.country_id) ?? null;
  const agencyOptions = selectedCountry?.agencies ?? [];

  function openCreate() {
    const firstCountry = scopeCountries[0];
    setEditing(null);
    setForm({
      ...emptyForm(),
      country_id: firstCountry?.id ?? '',
      agency_id: firstCountry?.agencies[0]?.id ?? '',
      scope: canCreateNational ? 'local' : 'local',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(campaign: AdCampaign) {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      branch: campaign.branch,
      scope: campaign.is_national ? 'national' : 'local',
      country_id: campaign.country_id,
      agency_id: campaign.agency_id ?? '',
      budget: String(campaign.budget),
      start_date: campaign.start_date.slice(0, 10),
      end_date: campaign.end_date.slice(0, 10),
      status: campaign.status,
      description: campaign.description ?? '',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    try {
      const payload = {
        name: form.name.trim(),
        branch: form.branch,
        is_national: form.scope === 'national',
        country_id: form.country_id || null,
        agency_id: form.scope === 'local' ? form.agency_id || null : null,
        budget: Number(form.budget),
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        description: form.description || null,
      };
      if (editing) {
        await adCampaignsApi.update(editing.id, payload);
        showToast(t('adCampaigns.updated'), 'success');
      } else {
        await adCampaignsApi.create(payload);
        showToast(t('adCampaigns.created'), 'success');
      }
      setFormOpen(false);
      load();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await adCampaignsApi.remove(deleting.id);
      showToast(t('adCampaigns.deleted'), 'success');
      setDeleting(null);
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('adCampaigns.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('adCampaigns.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('adCampaigns.newCampaign')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            label={t('adCampaigns.scope')}
            value={filterScope}
            onChange={(e) => { setFilterScope(e.target.value as '' | 'local' | 'national'); setPage(1); }}
          >
            <option value="">{t('adCampaigns.allScopes')}</option>
            <option value="local">{t('adCampaigns.scopeLocal')}</option>
            <option value="national">{t('adCampaigns.scopeNational')}</option>
          </Select>
          <Select
            label={t('adCampaigns.branch')}
            value={filterBranch}
            onChange={(e) => { setFilterBranch(e.target.value as '' | AdCampaignBranch); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>{t(`adCampaigns.branch${branch.charAt(0).toUpperCase() + branch.slice(1)}`)}</option>
            ))}
          </Select>
          <Select
            label={t('common.status')}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as AdCampaignStatus | ''); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{t(`adCampaigns.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}</option>
            ))}
          </Select>
          <Input
            label={t('common.search')}
            placeholder={t('adCampaigns.searchPlaceholder')}
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : campaigns.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('adCampaigns.noCampaigns')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('adCampaigns.name')}</th>
                  <th className="py-2 pr-3 font-medium">{t('adCampaigns.branch')}</th>
                  <th className="py-2 pr-3 font-medium">{t('adCampaigns.target')}</th>
                  <th className="py-2 pr-3 font-medium">{t('adCampaigns.period')}</th>
                  <th className="py-2 pr-3 font-medium">{t('common.status')}</th>
                  <th className="py-2 text-right font-medium">{t('adCampaigns.budget')}</th>
                  <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 shrink-0 text-gray-400" />
                        {campaign.name}
                      </div>
                      {campaign.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs font-normal text-gray-400">{campaign.description}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {t(`adCampaigns.branch${campaign.branch.charAt(0).toUpperCase() + campaign.branch.slice(1)}`)}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {campaign.is_national
                        ? `${t('adCampaigns.scopeNational')}${campaign.country ? ` — ${campaign.country.name}` : ''}`
                        : campaign.agency?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {new Date(campaign.start_date).toLocaleDateString(currentLocale())} →{' '}
                      {new Date(campaign.end_date).toLocaleDateString(currentLocale())}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[campaign.status]}`}>
                        {t(`adCampaigns.status${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}`)}
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(campaign.budget)}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(campaign)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(campaign)}
                          className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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

        {meta && meta.last_page > 1 && (
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
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('adCampaigns.editCampaign') : t('adCampaigns.newCampaign')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formErrors.general && <Alert variant="error">{formErrors.general}</Alert>}
          <Input
            label={t('adCampaigns.name')}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formErrors.name}
          />
          <Select
            label={t('adCampaigns.branch')}
            required
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value as AdCampaignBranch })}
            error={formErrors.branch}
          >
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>{t(`adCampaigns.branch${branch.charAt(0).toUpperCase() + branch.slice(1)}`)}</option>
            ))}
          </Select>
          <Select
            label={t('adCampaigns.scope')}
            required
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as 'local' | 'national' })}
            error={formErrors.is_national}
          >
            <option value="local">{t('adCampaigns.scopeLocal')}</option>
            {canCreateNational && <option value="national">{t('adCampaigns.scopeNational')}</option>}
          </Select>
          <Select
            label={t('adCampaigns.country')}
            required
            value={form.country_id}
            onChange={(e) => setForm({ ...form, country_id: e.target.value, agency_id: '' })}
            error={formErrors.country_id}
          >
            <option value="">{t('adCampaigns.selectCountry')}</option>
            {scopeCountries.map((country) => (
              <option key={country.id} value={country.id}>{country.name}</option>
            ))}
          </Select>
          {form.scope === 'local' && (
            <Select
              label={t('adCampaigns.agency')}
              required
              value={form.agency_id}
              onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
              error={formErrors.agency_id ?? (form.country_id && agencyOptions.length === 0 ? t('adCampaigns.noAgency') : undefined)}
            >
              <option value="">{t('adCampaigns.selectAgency')}</option>
              {agencyOptions.map((agency) => (
                <option key={agency.id} value={agency.id}>{agency.name}</option>
              ))}
            </Select>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={t('adCampaigns.startDate')}
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              error={formErrors.start_date}
            />
            <Input
              label={t('adCampaigns.endDate')}
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              error={formErrors.end_date}
            />
          </div>
          <Input
            label={t('adCampaigns.budget')}
            type="number"
            min={0}
            step="0.01"
            required
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            error={formErrors.budget}
          />
          <Select
            label={t('common.status')}
            required
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as AdCampaignStatus })}
            error={formErrors.status}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{t(`adCampaigns.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}</option>
            ))}
          </Select>
          <Input
            label={t('adCampaigns.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            error={formErrors.description}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={submitting} className="flex-1">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title={t('adCampaigns.deleteTitle')}
        message={t('adCampaigns.deleteMessage', { name: deleting?.name ?? '' })}
        confirmLabel={t('common.delete')}
        isLoading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function extractFieldErrors(error: unknown): Record<string, string> {
  const err = error as { response?: { data?: { errors?: Record<string, string[]> } } };
  const fields = err?.response?.data?.errors;
  if (!fields) return { general: 'Erreur' };
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fields)) {
    result[key] = messages[0] ?? '';
  }
  return result;
}
