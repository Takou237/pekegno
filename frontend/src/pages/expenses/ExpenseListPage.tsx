import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Send, CheckCircle, XCircle, Banknote, Lock, Undo2, Trash2, Eye, Camera, Paperclip } from 'lucide-react';
import { expensesApi } from '@/api/expenses.api';
import { accountingApi } from '@/api/accounting.api';
import { scopeApi, type ScopeCountry } from '@/api/scope.api';
import { servicesApi } from '@/api/services.api';
import { treasuryApi } from '@/api/treasury.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import type { Expense, ExpenseStatus } from '@/types/expenses';
import type { AccountingCategory } from '@/types/accounting';
import type { TreasuryAccount } from '@/types/treasury';
import type { PaginationMeta } from '@/types/agency';

/** Rôles qui saisissent les dépenses de l'Administration d'un pays. */
const ADMINISTRATION_ROLES = ['super-admin', 'direction-generale', 'comptable'];

const STATUS_BADGES: Record<ExpenseStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

interface ExpenseListPageProps {
  /** Affichée dans un onglet de la Comptabilité (sans grand titre de page). */
  embedded?: boolean;
  /** Change de valeur pour ouvrir le formulaire de sortie (depuis « Nouvelle transaction »). */
  createSignal?: number;
  /** Pré-remplissage venant du formulaire de transaction. */
  prefill?: { amount?: string; expense_date?: string; note?: string; category_id?: string };
}

/**
 * Sorties (cahier §14) : circuit brouillon → soumise → validée → payée, avec
 * photo du justificatif, rattachement à une agence ou à l'Administration du
 * pays, et à un séminaire. Une sortie payée crée son écriture en Comptabilité.
 */
export default function ExpenseListPage({ embedded = false, createSignal, prefill }: ExpenseListPageProps = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(1);

  const { user } = useAuth();
  const canAdministration = ADMINISTRATION_ROLES.includes(user?.role?.name ?? '');

  const [createOpen, setCreateOpen] = useState(false);
  // Cible : « agency:<uuid> » ou « country:<uuid> » (Administration du pays).
  const [form, setForm] = useState({ target: '', category_id: '', amount: '', expense_date: '', note: '', service_id: '' });
  const [scopeCountries, setScopeCountries] = useState<ScopeCountry[]>([]);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  // T3.14 — séminaires vendus : un événement auquel rattacher la dépense.
  const [seminars, setSeminars] = useState<{ id: string; name: string; agency_name?: string | null }[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createFile, setCreateFile] = useState<File | null>(null);

  const [detail, setDetail] = useState<Expense | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Justificatif (CdC §14) : photo du reçu, prise au téléphone ou choisie.
  async function attachJustification(expense: Expense, file: File | undefined) {
    if (!file) return;
    setUploadingId(expense.id);
    try {
      const updated = await expensesApi.uploadJustification(expense.id, file);
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      showToast(t('expenses.justificationSaved'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setUploadingId(null);
    }
  }

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [payExpense, setPayExpense] = useState<Expense | null>(null);
  const [payAccounts, setPayAccounts] = useState<TreasuryAccount[]>([]);
  const [payAccount, setPayAccount] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    expensesApi.list({
      status: filterStatus || undefined,
      search: filterSearch || undefined,
      page,
      per_page: 15,
    })
      .then((res) => {
        setExpenses(res.data);
        setMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, per_page: res.per_page });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, filterSearch, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    scopeApi
      .getContext()
      .then((ctx) => setScopeCountries(ctx.countries))
      .catch(() => setScopeCountries([]));
    accountingApi
      .categories({ silentForbidden: true })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [createOpen]);

  // T3.14 — le serveur refuse un séminaire d'une autre agence : on ne propose
  // que ceux de l'agence de la dépense (ou tous pour une dépense
  // d'Administration, sans agence).
  useEffect(() => {
    if (!createOpen) return;
    if (!form.target) {
      setSeminars([]);
      return;
    }
    const agencyId = form.target.startsWith('agency:')
      ? form.target.slice('agency:'.length)
      : undefined;
    let active = true;
    servicesApi
      .list({
        is_seminar: true,
        per_page: 100,
        agency_id: agencyId,
      })
      .then((res) => {
        if (active) {
          setSeminars(res.data.map((s) => ({ id: s.id, name: s.name, agency_name: s.agency?.name ?? null })));
        }
      })
      .catch(() => {
        if (active) setSeminars([]);
      });
    return () => {
      active = false;
    };
  }, [createOpen, form.target]);

  const selectedAgencyId = form.target.startsWith('agency:') ? form.target.slice('agency:'.length) : null;
  const categoryOptions = categories.filter(
    (c) => c.type === 'expense' && (c.agency_id === null || c.agency_id === selectedAgencyId),
  );

  function openCreate() {
    setForm({ target: '', category_id: prefill?.category_id ?? '', amount: prefill?.amount ?? '', expense_date: prefill?.expense_date ?? '', note: prefill?.note ?? '', service_id: '' });
    setCreateFile(null);
    setFormErrors({});
    setCreateOpen(true);
  }

  // Ouverture demandée depuis « Nouvelle transaction » de type Sortie.
  useEffect(() => {
    if (createSignal) openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSignal]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    try {
      const isAdministration = form.target.startsWith('country:');
      const created = await expensesApi.create({
        ...(isAdministration
          ? { country_id: form.target.slice('country:'.length) }
          : { agency_id: form.target.slice('agency:'.length) }),
        category_id: form.category_id,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        note: form.note || undefined,
        service_id: form.service_id || undefined,
      });
      // Photo du justificatif jointe dès la saisie.
      if (createFile) {
        await expensesApi.uploadJustification(created.id, createFile).catch(() => {
          showToast(t('expenses.justificationFailed'), 'error');
        });
      }
      showToast(t('expenses.created'), 'success');
      setCreateOpen(false);
      load();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(action: string, id: string, extra?: string) {
    try {
      switch (action) {
        case 'submit':
          await expensesApi.submit(id);
          showToast(t('expenses.submitted'), 'success');
          break;
        case 'approve':
          await expensesApi.approve(id);
          showToast(t('expenses.approved'), 'success');
          break;
        case 'reject':
          await expensesApi.reject(id, extra!);
          showToast(t('expenses.rejected'), 'success');
          setRejectOpen(false);
          setRejectReason('');
          break;
        case 'close':
          await expensesApi.close(id);
          showToast(t('expenses.closed'), 'success');
          break;
        case 'reopen':
          await expensesApi.reopen(id);
          showToast(t('expenses.reopened'), 'success');
          break;
        case 'delete':
          await expensesApi.remove(id);
          showToast(t('expenses.deleted'), 'success');
          break;
      }
      load();
      setDetail(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function handlePay() {
    if (!payExpense) return;
    try {
      await expensesApi.pay(payExpense.id, payAccount);
      showToast(t('expenses.paid'), 'success');
      setPayOpen(false);
      load();
      setDetail(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  /** Caisses de l'agence de la dépense, ou de l'Administration de son pays. */
  function openPay(expense: Expense) {
    setPayExpense(expense);
    setPayAccount('');
    setPayAccounts([]);
    setPayOpen(true);
    treasuryApi
      .listAccounts(
        expense.agency_id
          ? { agency_id: expense.agency_id }
          : { administration: true, country_id: expense.country_id ?? undefined },
      )
      .then(setPayAccounts)
      .catch(() => setPayAccounts([]));
  }

  function openDetail(exp: Expense) {
    expensesApi.get(exp.id).then(setDetail).catch(() => setDetail(exp));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          {embedded ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('expenses.embeddedSubtitle')}</p>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('expenses.title')}</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('expenses.subtitle')}</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('expenses.newExpense')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            label={t('expenses.filterByStatus')}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as ExpenseStatus | ''); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            <option value="draft">{t('expenses.statusDraft')}</option>
            <option value="submitted">{t('expenses.statusSubmitted')}</option>
            <option value="approved">{t('expenses.statusApproved')}</option>
            <option value="rejected">{t('expenses.statusRejected')}</option>
            <option value="paid">{t('expenses.statusPaid')}</option>
            <option value="closed">{t('expenses.statusClosed')}</option>
          </Select>
          <Input
            label={t('common.search')}
            placeholder={t('expenses.searchPlaceholder')}
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : expenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('expenses.noExpenses')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('expenses.number')}</th>
                  <th className="py-2 pr-3 font-medium">{t('expenses.date')}</th>
                  <th className="py-2 pr-3 font-medium">{t('expenses.category')}</th>
                  <th className="py-2 pr-3 font-medium">{t('expenses.requestor')}</th>
                  <th className="py-2 pr-3 font-medium">{t('common.status')}</th>
                  <th className="py-2 pr-3 font-medium">{t('expenses.justification')}</th>
                  <th className="py-2 text-right font-medium">{t('expenses.amount')}</th>
                  <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{exp.number}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{new Date(exp.expense_date).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{exp.category?.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {exp.requestor ? `${exp.requestor.first_name} ${exp.requestor.last_name}` : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[exp.status]}`}>
                        {t(`expenses.status${exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}`)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {exp.justification_url && (
                          <a href={exp.justification_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                            <Paperclip className="h-3.5 w-3.5" />
                            {t('expenses.viewJustification')}
                          </a>
                        )}
                        <label className={`inline-flex cursor-pointer items-center gap-1 rounded p-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 ${uploadingId === exp.id ? 'opacity-50' : ''}`} title={t('expenses.attachJustification')}>
                          {uploadingId === exp.id ? <Spinner /> : <Camera className="h-4 w-4" />}
                          {!exp.justification_url && <span>{t('expenses.attachJustification')}</span>}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            disabled={uploadingId === exp.id}
                            onChange={(e) => { attachJustification(exp, e.target.files?.[0]); e.target.value = ''; }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(exp)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                          <Eye className="h-4 w-4" />
                        </button>
                        {exp.status === 'draft' && (
                          <button onClick={() => handleAction('submit', exp.id)} className="rounded p-1 text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" title={t('expenses.submit')}>
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {exp.status === 'submitted' && (
                          <>
                            <button onClick={() => handleAction('approve', exp.id)} className="rounded p-1 text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20" title={t('expenses.approve')}>
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setRejectTarget(exp.id); setRejectOpen(true); }} className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('expenses.reject')}>
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {exp.status === 'approved' && (
                          <button onClick={() => openPay(exp)} className="rounded p-1 text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20" title={t('expenses.pay')}>
                            <Banknote className="h-4 w-4" />
                          </button>
                        )}
                        {exp.status === 'paid' && (
                          <button onClick={() => handleAction('close', exp.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title={t('expenses.close')}>
                            <Lock className="h-4 w-4" />
                          </button>
                        )}
                        {exp.status === 'rejected' && (
                          <button onClick={() => handleAction('reopen', exp.id)} className="rounded p-1 text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20" title={t('expenses.reopen')}>
                            <Undo2 className="h-4 w-4" />
                          </button>
                        )}
                        {(exp.status === 'draft' || exp.status === 'rejected') && (
                          <button onClick={() => handleAction('delete', exp.id)} className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('common.delete')}>
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

        {meta && meta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={meta.per_page} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t('expenses.newExpense')} maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {formErrors.general && <Alert variant="error">{formErrors.general}</Alert>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('expenses.target')} *
            </label>
            <select
              required
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value, category_id: '', service_id: '' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">—</option>
              {canAdministration && (
                <optgroup label={t('expenses.administrationGroup')}>
                  {scopeCountries.map((c) => (
                    <option key={`country-${c.id}`} value={`country:${c.id}`}>
                      {t('expenses.administrationOption', { country: c.name })}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t('expenses.agencyGroup')}>
                {scopeCountries.flatMap((country) =>
                  country.agencies.map((a) => (
                    <option key={`agency-${a.id}`} value={`agency:${a.id}`}>
                      {scopeCountries.length > 1 ? `${a.name} — ${country.name}` : a.name}
                    </option>
                  )),
                )}
              </optgroup>
            </select>
            {formErrors.agency_id && <p className="mt-1 text-xs text-red-500">{formErrors.agency_id}</p>}
            {formErrors.country_id && <p className="mt-1 text-xs text-red-500">{formErrors.country_id}</p>}
          </div>
          <Select
            label={`${t('expenses.category')} *`}
            required
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            error={formErrors.category_id}
          >
            <option value="">—</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label={t('expenses.amount')} type="number" min={0.01} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={formErrors.amount} />
          <Input label={t('expenses.date')} type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} error={formErrors.expense_date} />
          <Select
            label={t('expenses.event')}
            value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            error={formErrors.service_id}
          >
            <option value="">{t('expenses.eventNone')}</option>
            {seminars.map((s) => (
              <option key={s.id} value={s.id}>
                {s.agency_name ? `${s.name} — ${s.agency_name}` : s.name}
              </option>
            ))}
          </Select>
          <Input label={t('expenses.note')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('expenses.justification')}</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 dark:text-gray-300"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('expenses.circuitHint')}</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={submitting} className="flex-1">{t('common.create')}</Button>
          </div>
        </form>
      </Modal>

      {/* Reject modal */}
      <Modal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} title={t('expenses.reject')} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <Input label={t('expenses.rejectionReason')} required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRejectOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={() => handleAction('reject', rejectTarget, rejectReason)} disabled={!rejectReason.trim()} className="flex-1">{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>

      {/* Pay modal */}
      <Modal isOpen={payOpen} onClose={() => setPayOpen(false)} title={t('expenses.pay')} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          {payExpense && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {payExpense.number} — {formatCurrency(payExpense.amount)}
              {payExpense.country?.name ? ` · ${t('expenses.administrationOption', { country: payExpense.country.name })}` : ''}
            </p>
          )}
          <Select
            label={t('expenses.treasuryAccount')}
            required
            value={payAccount}
            onChange={(e) => setPayAccount(e.target.value)}
            error={payAccounts.length === 0 ? t('expenses.noTreasuryAccount') : undefined}
          >
            <option value="">—</option>
            {payAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code ? `${a.code} · ` : ''}{a.name} ({formatCurrency(a.balance)})
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPayOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handlePay} disabled={!payAccount} className="flex-1">{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      {detail && (
        <Modal isOpen={true} onClose={() => setDetail(null)} title={`${t('expenses.detail')} — ${detail.number}`} maxWidth="max-w-lg">
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">{t('expenses.amount')}:</span> <span className="font-medium">{formatCurrency(detail.amount)}</span></div>
              <div><span className="text-gray-500">{t('common.status')}:</span> <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[detail.status]}`}>{t(`expenses.status${detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}`)}</span></div>
              <div><span className="text-gray-500">{t('expenses.date')}:</span> {new Date(detail.expense_date).toLocaleDateString()}</div>
              <div><span className="text-gray-500">{t('expenses.category')}:</span> {detail.category?.name ?? '—'}</div>
              <div><span className="text-gray-500">{t('expenses.requestor')}:</span> {detail.requestor ? `${detail.requestor.first_name} ${detail.requestor.last_name}` : '—'}</div>
              <div><span className="text-gray-500">{t('expenses.target')}:</span> {detail.agency?.name ?? (detail.country ? t('expenses.administrationOption', { country: detail.country.name }) : '—')}</div>
            </div>
            {detail.note && <div><span className="text-gray-500">{t('expenses.note')}:</span> {detail.note}</div>}
            {detail.rejection_reason && <div><span className="text-red-500">{t('expenses.rejectionReason')}:</span> {detail.rejection_reason}</div>}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setDetail(null)}>{t('common.close')}</Button>
            </div>
          </div>
        </Modal>
      )}
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
