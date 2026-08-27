import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Send, CheckCircle, XCircle, Banknote, Lock, Undo2, Trash2, Eye } from 'lucide-react';
import { expensesApi } from '@/api/expenses.api';
import { extractErrorMessage } from '@/api/errors';
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
import type { PaginationMeta } from '@/types/agency';

const STATUS_BADGES: Record<ExpenseStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export default function ExpenseListPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ agency_id: '', category_id: '', amount: '', expense_date: '', note: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState<Expense | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState('');
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    try {
      await expensesApi.create({
        agency_id: form.agency_id,
        category_id: form.category_id,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        note: form.note || undefined,
      });
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
    try {
      await expensesApi.pay(payTarget, payAccount);
      showToast(t('expenses.paid'), 'success');
      setPayOpen(false);
      load();
      setDetail(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  function openDetail(exp: Expense) {
    expensesApi.get(exp.id).then(setDetail).catch(() => setDetail(exp));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('expenses.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setCreateOpen(true)}>
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
                          <button onClick={() => { setPayTarget(exp.id); setPayOpen(true); }} className="rounded p-1 text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20" title={t('expenses.pay')}>
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
          <Input label={t('expenses.agencyId')} required value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })} error={formErrors.agency_id} />
          <Input label={t('expenses.categoryId')} required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} error={formErrors.category_id} />
          <Input label={t('expenses.amount')} type="number" min={0.01} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={formErrors.amount} />
          <Input label={t('expenses.date')} type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} error={formErrors.expense_date} />
          <Input label={t('expenses.note')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
          <Input label={t('expenses.treasuryAccountId')} required value={payAccount} onChange={(e) => setPayAccount(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPayOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handlePay} disabled={!payAccount.trim()} className="flex-1">{t('common.confirm')}</Button>
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
              <div><span className="text-gray-500">{t('expenses.agencyId')}:</span> {detail.agency?.name ?? '—'}</div>
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
