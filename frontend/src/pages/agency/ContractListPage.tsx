import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Eye, RotateCcw, XOctagon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { contractsApi } from '@/api/contracts.api';
import { clientsApi } from '@/api/clients.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import {
  Contract,
  ContractStatus,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  BILLING_CYCLE_LABELS,
  BillingCycle,
} from '@/types/contract';
import type { PaginationMeta } from '@/types/agency';
import type { ClientListItem } from '@/types/client';

const STATUS_LIST: ContractStatus[] = ['active', 'due_soon', 'expired', 'suspended', 'terminated'];
const BILLING_CYCLES: BillingCycle[] = ['one_shot', 'monthly', 'quarterly', 'yearly'];

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function extractFieldErrors(error: unknown): Record<string, string> {
  const err = error as { response?: { data?: { errors?: Record<string, string[]> } } };
  const fields = err?.response?.data?.errors;
  if (!fields) return { general: extractErrorMessage(error, 'Erreur') };
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fields)) {
    result[key] = messages[0] ?? '';
  }
  return result;
}

interface FormState {
  client_id: string;
  agency_id: string;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  amount: string;
  auto_renew: boolean;
  notes: string;
}

const emptyForm: FormState = {
  client_id: '',
  agency_id: '',
  start_date: '',
  end_date: '',
  billing_cycle: 'monthly',
  amount: '',
  auto_renew: false,
  notes: '',
};

export default function ContractListPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState('');
  const [terminateReason, setTerminateReason] = useState('');

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientListItem[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    contractsApi
      .list({
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        page,
        per_page: 15,
      })
      .then((res) => {
        setContracts(res.data);
        setMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, per_page: res.per_page });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, filterSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      clientsApi
        .list({ search: clientSearch, per_page: 10 })
        .then((res) => setClientResults(res.data))
        .catch(() => setClientResults([]));
    }, 350);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    try {
      await contractsApi.create({
        client_id: form.client_id,
        agency_id: form.agency_id,
        start_date: form.start_date,
        end_date: form.end_date,
        billing_cycle: form.billing_cycle,
        amount: Number(form.amount),
        auto_renew: form.auto_renew,
        notes: form.notes || undefined,
      });
      showToast(t('contracts.created'), 'success');
      setCreateOpen(false);
      setForm(emptyForm);
      load();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenew(id: string) {
    try {
      await contractsApi.renew(id);
      showToast(t('contracts.renewed'), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function handleTerminate() {
    if (!terminateTarget || !terminateReason.trim()) return;
    try {
      await contractsApi.terminate(terminateTarget, terminateReason);
      showToast(t('contracts.terminated'), 'success');
      setTerminateOpen(false);
      setTerminateReason('');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('contracts.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('contracts.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('contracts.newContract')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.status')}</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">{t('common.all')}</option>
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <Input
            label={t('common.search')}
            placeholder={t('contracts.searchPlaceholder')}
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : contracts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('contracts.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('contracts.number')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.clients')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.startDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.endDate')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('contracts.amount')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.billingCycle')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.daysLeft')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {contracts.map((c) => {
                  const days = daysUntil(c.end_date);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{c.number}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {c.client
                          ? [c.client.first_name, c.client.last_name].filter(Boolean).join(' ') || '—'
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(c.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(c.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                        {formatCurrency(c.amount)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {BILLING_CYCLE_LABELS[c.billing_cycle]}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-sm font-medium ${days < 0 ? 'text-red-600 dark:text-red-400' : days <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`}>
                          {days < 0 ? `${Math.abs(days)}j` : `${days}j`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>
                          {CONTRACT_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/contracts/${c.id}`}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title={t('common.viewDetails')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {(c.status === 'active' || c.status === 'due_soon') && (
                            <button
                              type="button"
                              onClick={() => handleRenew(c.id)}
                              className="rounded p-1 text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                              title={t('contracts.renew')}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {(c.status === 'active' || c.status === 'due_soon' || c.status === 'suspended') && (
                            <button
                              type="button"
                              onClick={() => { setTerminateTarget(c.id); setTerminateOpen(true); }}
                              className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title={t('contracts.terminate')}
                            >
                              <XOctagon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t('contracts.newContract')} maxWidth="max-w-xl">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {formErrors.general && <Alert variant="error">{formErrors.general}</Alert>}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('nav.clients')} *
            </label>
            <Input
              placeholder={t('contracts.searchClient')}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            {clientResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {clientResults.map((cl) => (
                  <button
                    key={cl.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, client_id: cl.id });
                      setClientSearch([cl.first_name, cl.last_name].filter(Boolean).join(' ') || cl.email);
                      setClientResults([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {[cl.first_name, cl.last_name].filter(Boolean).join(' ') || cl.email}
                  </button>
                ))}
              </div>
            )}
            {formErrors.client_id && <p className="mt-1 text-xs text-red-500">{formErrors.client_id}</p>}
          </div>

          <Input
            label={t('contracts.agencyId')}
            required
            value={form.agency_id}
            onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
            error={formErrors.agency_id}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('contracts.startDate')}
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              error={formErrors.start_date}
            />
            <Input
              label={t('contracts.endDate')}
              type="date"
              required
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              error={formErrors.end_date}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('contracts.billingCycle')} *
              </label>
              <select
                value={form.billing_cycle}
                onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as BillingCycle })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {BILLING_CYCLES.map((bc) => (
                  <option key={bc} value={bc}>{BILLING_CYCLE_LABELS[bc]}</option>
                ))}
              </select>
            </div>
            <Input
              label={t('contracts.amount')}
              type="number"
              min={0}
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={formErrors.amount}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto_renew"
              checked={form.auto_renew}
              onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="auto_renew" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('contracts.autoRenew')}
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('contracts.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={submitting} className="flex-1">{t('common.create')}</Button>
          </div>
        </form>
      </Modal>

      {/* Terminate modal */}
      <Modal isOpen={terminateOpen} onClose={() => setTerminateOpen(false)} title={t('contracts.terminate')} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <Input
            label={t('contracts.terminateReason')}
            required
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setTerminateOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleTerminate} disabled={!terminateReason.trim()} className="flex-1">{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
