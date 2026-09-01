import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Download, Pencil, Trash2, Tag, Banknote } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { accountingApi } from '@/api/accounting.api';
import { commissionsApi } from '@/api/commissions.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';
import { canExportData } from '@/utils/exportPermissions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import type { AccountingTransaction, AccountingCategory, AccountingType, AccountingTransactionPayload } from '@/types/accounting';
import type { CommissionBeneficiary } from '@/types/commissions';
import type { PaginationMeta } from '@/types/agency';
import type { PaymentMethod } from '@/types/invoice';

export default function AccountingPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { agencyId: routeAgencyId } = useParams<{ agencyId?: string }>();
  const agencyId = fixedAgencyId ?? routeAgencyId ?? '';
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [serverTotals, setServerTotals] = useState<{ income: number; expense: number; balance: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [txOpen, setTxOpen] = useState(false);
  const [editTx, setEditTx] = useState<AccountingTransaction | null>(null);
  const [txForm, setTxForm] = useState({
    type: 'income' as AccountingType,
    label: '',
    amount: '',
    category_id: '',
    transacted_at: new Date().toISOString().slice(0, 10),
    reference: '',
    note: '',
    beneficiary: '',
  });
  const [txErrors, setTxErrors] = useState<Record<string, string>>({});
  const [txSubmitting, setTxSubmitting] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<AccountingCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<AccountingType>('income');
  const [catErrors, setCatErrors] = useState<Record<string, string>>({});
  const [catSubmitting, setCatSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AccountingTransaction | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<AccountingCategory | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payBeneficiaries, setPayBeneficiaries] = useState<CommissionBeneficiary[]>([]);
  const [payLoading, setPayLoading] = useState(false);
  const [payForm, setPayForm] = useState({ beneficiary_id: '', amount: '', note: '', payment_method: 'cash' as PaymentMethod });
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [paySubmitting, setPaySubmitting] = useState(false);

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence', 'comptable'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchCategories = useCallback(() => {
    accountingApi.categories().then((d) => setCategories(d ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await accountingApi.list({
        search: search || undefined,
        type: (typeFilter as AccountingType) || undefined,
        agency_id: agencyId || undefined,
        category_id: categoryFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        per_page: 15,
      });
      setTransactions(res.transactions?.data ?? []);
      setMeta(res.transactions?.meta ?? null);
      if (res.totals) {
        setServerTotals(res.totals);
      }
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('accounting.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, agencyId, categoryFilter, from, to, page, t]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totals = serverTotals ?? {
    income: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
    expense: transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    balance: transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) -
      transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
  };

  function openCreateTx() {
    setEditTx(null);
    setTxForm({
      type: 'income',
      label: '',
      amount: '',
      category_id: '',
      transacted_at: new Date().toISOString().slice(0, 10),
      reference: '',
      note: '',
      beneficiary: '',
    });
    setTxErrors({});
    setTxOpen(true);
  }

  function openEditTx(tx: AccountingTransaction) {
    setEditTx(tx);
    setTxForm({
      type: tx.type,
      label: tx.label,
      amount: tx.amount,
      category_id: tx.category_id ?? '',
      transacted_at: tx.transacted_at?.slice(0, 10) ?? '',
      reference: tx.reference ?? '',
      note: tx.note ?? '',
      beneficiary: tx.beneficiary ?? '',
    });
    setTxErrors({});
    setTxOpen(true);
  }

  async function handleTxSubmit(event: FormEvent) {
    event.preventDefault();
    setTxSubmitting(true);
    setTxErrors({});
    try {
      const payload: AccountingTransactionPayload = {
        type: txForm.type,
        label: txForm.label.trim(),
        amount: Number(txForm.amount),
        category_id: txForm.category_id || null,
        transacted_at: txForm.transacted_at,
        reference: txForm.reference.trim() || null,
        note: txForm.note.trim() || null,
        beneficiary: txForm.beneficiary.trim() || null,
        agency_id: agencyId || null,
      };
      if (editTx) {
        await accountingApi.update(editTx.id, payload);
        showToast(t('accounting.updated'), 'success');
      } else {
        await accountingApi.create(payload);
        showToast(t('accounting.created'), 'success');
      }
      setTxOpen(false);
      fetchTransactions();
    } catch (error) {
      setTxErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('accounting.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setTxSubmitting(false);
    }
  }

  async function handleDeleteTx() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await accountingApi.remove(deleteTarget.id);
      showToast(t('accounting.deleted'), 'success');
      setDeleteTarget(null);
      fetchTransactions();
    } catch (error) {
      showToast(extractErrorMessage(error, t('accounting.deleteFailed')), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function openCreateCat() {
    setEditCat(null);
    setCatName('');
    setCatType('income');
    setCatErrors({});
    setCatOpen(true);
  }

  async function handleCatSubmit(event: FormEvent) {
    event.preventDefault();
    setCatSubmitting(true);
    setCatErrors({});
    try {
      const payload = { name: catName.trim(), type: catType, agency_id: agencyId || null };
      if (editCat) {
        await accountingApi.updateCategory(editCat.id, payload);
        showToast(t('accounting.categoryUpdated'), 'success');
      } else {
        await accountingApi.createCategory(payload);
        showToast(t('accounting.categoryCreated'), 'success');
      }
      setCatOpen(false);
      fetchCategories();
    } catch (error) {
      setCatErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('accounting.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setCatSubmitting(false);
    }
  }

  async function handleDeleteCat() {
    if (!deleteCatTarget) return;
    setDeleteSubmitting(true);
    try {
      await accountingApi.removeCategory(deleteCatTarget.id);
      showToast(t('accounting.categoryDeleted'), 'success');
      setDeleteCatTarget(null);
      fetchCategories();
    } catch (error) {
      showToast(extractErrorMessage(error, t('accounting.deleteFailed')), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('accounting');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  function openPayModal() {
    setPayForm({ beneficiary_id: '', amount: '', note: '', payment_method: 'cash' as PaymentMethod });
    setPayErrors({});
    setPayOpen(true);
    setPayLoading(true);
    setPayBeneficiaries([]);
    commissionsApi
      .summaryBeneficiaries({ agency_id: agencyId || undefined })
      .then((res) => setPayBeneficiaries(res.data ?? []))
      .catch(() => setPayBeneficiaries([]))
      .finally(() => setPayLoading(false));
  }

  const payableBeneficiaries = payBeneficiaries.filter((b) => Number(b.balance ?? 0) > 0);

  function selectedBeneficiary(): CommissionBeneficiary | undefined {
    return payableBeneficiaries.find((b) => b.id === payForm.beneficiary_id);
  }

  async function handlePayCommission(event: FormEvent) {
    event.preventDefault();
    setPaySubmitting(true);
    setPayErrors({});
    try {
      const beneficiary = selectedBeneficiary();
      if (!beneficiary) throw new Error(t('accounting.selectBeneficiary'));
      await commissionsApi.payCommission({
        beneficiary_type: beneficiary.type,
        beneficiary_id: beneficiary.id,
        amount: Number(payForm.amount),
        payment_method: payForm.payment_method,
        note: payForm.note.trim() || undefined,
      });
      showToast(t('accounting.commissionPaid'), 'success');
      setPayOpen(false);
      fetchTransactions();
    } catch (error) {
      setPayErrors({ general: extractErrorMessage(error, t('accounting.commissionPaymentFailed')) });
    } finally {
      setPaySubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('accounting.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('accounting.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {canExportData(currentUser) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('accounting.export')}
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="outline" onClick={openCreateCat}>
                <Tag className="h-4 w-4" />
                {t('accounting.newCategory')}
              </Button>
              <Button variant="outline" onClick={openPayModal}>
                <Banknote className="h-4 w-4" />
                {t('accounting.payCommission')}
              </Button>
              <Button onClick={openCreateTx}>
                <Plus className="h-4 w-4" />
                {t('accounting.newTransaction')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('accounting.totalIncome')}</p>
          <p className="mt-1 text-xl font-semibold text-success-600">{formatCurrency(totals.income)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('accounting.totalExpense')}</p>
          <p className="mt-1 text-xl font-semibold text-error-500">{formatCurrency(totals.expense)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('accounting.netBalance')}</p>
          <p className={`mt-1 text-xl font-semibold ${totals.balance >= 0 ? 'text-success-600' : 'text-error-500'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Input
            label={t('common.search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('accounting.searchPlaceholder')}
          />
          <Select label={t('accounting.filterType')} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">{t('common.selectAll')}</option>
            <option value="income">{t('accounting.typeIncome')}</option>
            <option value="expense">{t('accounting.typeExpense')}</option>
          </Select>
          <Select label={t('accounting.filterCategory')} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">{t('common.selectAll')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input label={t('invoices.filterFrom')} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input label={t('invoices.filterTo')} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : transactions.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('accounting.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('accounting.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('accounting.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('accounting.colLabel')}</th>
                  <th className="px-5 py-3 font-medium">{t('accounting.colCategory')}</th>
                  <th className="px-5 py-3 font-medium">{t('accounting.colType')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('accounting.colAmount')}</th>
                  <th className="px-5 py-3 font-medium">{t('accounting.colReference')}</th>
                  <th className="px-5 py-3 font-medium">{t('accounting.colBeneficiary')}</th>
                  {canManage && <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{tx.number}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {tx.transacted_at ? new Date(tx.transacted_at).toLocaleDateString(currentLocale()) : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{tx.label}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{tx.category?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      {tx.type === 'income' ? (
                        <Badge variant="success">{t('accounting.typeIncome')}</Badge>
                      ) : (
                        <Badge variant="error">{t('accounting.typeExpense')}</Badge>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium ${tx.type === 'income' ? 'text-success-600' : 'text-error-500'}`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{tx.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{tx.beneficiary ?? '—'}</td>
                    {canManage && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => openEditTx(tx)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" title={t('common.edit')}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(tx)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800" title={t('common.delete')}>
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
        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={meta.per_page} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Modal isOpen={txOpen} onClose={() => setTxOpen(false)} title={editTx ? t('accounting.editTransaction') : t('accounting.newTransaction')} maxWidth="max-w-lg">
        <form onSubmit={handleTxSubmit} className="flex flex-col gap-4">
          {Object.keys(txErrors).length > 0 && <Alert variant="error">{Object.values(txErrors).join(' ')}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('accounting.colType')} required value={txForm.type} onChange={(e) => setTxForm((f) => ({ ...f, type: e.target.value as AccountingType }))}>
              <option value="income">{t('accounting.typeIncome')}</option>
              <option value="expense">{t('accounting.typeExpense')}</option>
            </Select>
            <Input label={t('accounting.colAmount')} type="number" min="0.01" step="0.01" required value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} error={txErrors.amount} />
          </div>
          <Input label={t('accounting.colLabel')} required value={txForm.label} onChange={(e) => setTxForm((f) => ({ ...f, label: e.target.value }))} error={txErrors.label} />
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('accounting.colCategory')} value={txForm.category_id} onChange={(e) => setTxForm((f) => ({ ...f, category_id: e.target.value }))}>
              <option value="">{t('accounting.noCategory')}</option>
              {categories.filter((c) => c.type === txForm.type).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input label={t('accounting.colDate')} type="date" required value={txForm.transacted_at} onChange={(e) => setTxForm((f) => ({ ...f, transacted_at: e.target.value }))} />
          </div>
          <Input label={t('accounting.colReference')} value={txForm.reference} onChange={(e) => setTxForm((f) => ({ ...f, reference: e.target.value }))} />
          <Input label={t('accounting.colBeneficiary')} value={txForm.beneficiary} onChange={(e) => setTxForm((f) => ({ ...f, beneficiary: e.target.value }))} />
          <Input label={t('accounting.colNote')} value={txForm.note} onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setTxOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={txSubmitting} className="flex-1">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={catOpen} onClose={() => setCatOpen(false)} title={editCat ? t('accounting.editCategory') : t('accounting.newCategory')} maxWidth="max-w-md">
        <form onSubmit={handleCatSubmit} className="flex flex-col gap-4">
          {Object.keys(catErrors).length > 0 && <Alert variant="error">{Object.values(catErrors).join(' ')}</Alert>}
          <Input label={t('accounting.colLabel')} required value={catName} onChange={(e) => setCatName(e.target.value)} error={catErrors.name} />
          <Select label={t('accounting.colType')} required value={catType} onChange={(e) => setCatType(e.target.value as AccountingType)}>
            <option value="income">{t('accounting.typeIncome')}</option>
            <option value="expense">{t('accounting.typeExpense')}</option>
          </Select>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCatOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={catSubmitting} className="flex-1">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={payOpen} onClose={() => setPayOpen(false)} title={t('accounting.payCommission')} maxWidth="max-w-lg">
        <form onSubmit={handlePayCommission} className="flex flex-col gap-4">
          <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">{t('accounting.payCommissionSubtitle')}</p>
          {payErrors.general && <Alert variant="error">{payErrors.general}</Alert>}

          <Select label={`${t('accounting.selectBeneficiary')} *`} required value={payForm.beneficiary_id} onChange={(e) => setPayForm((f) => ({ ...f, beneficiary_id: e.target.value }))} error={payErrors.beneficiary_id}>
            <option value=""></option>
            {payableBeneficiaries.map((b) => (
              <option key={`${b.type}-${b.id}`} value={b.id}>
                {b.name} — {formatCurrency(Number(b.balance ?? 0))}
              </option>
            ))}
          </Select>

          {selectedBeneficiary() && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <span>{t('accounting.beneficiaryBalance')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(selectedBeneficiary()?.balance ?? 0))}</span>
            </div>
          )}

          <Input
            label={`${t('common.amount')} *`}
            type="number" min="0.01"
            max={selectedBeneficiary() ? Number(selectedBeneficiary()?.balance) || undefined : undefined}
            step="0.01" required
            value={payForm.amount}
            onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            error={payErrors.amount}
          />

          <Select
            label={t('invoices.headerPaymentType')}
            value={payForm.payment_method}
            onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value as PaymentMethod }))}
          >
            <option value="cash">{t('invoices.paymentCash')}</option>
            <option value="om">{t('invoices.paymentOm')}</option>
            <option value="momo">{t('invoices.paymentMomo')}</option>
          </Select>

          <Input label={t('accounting.colNote')} value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />

          {payLoading && <p className="text-center text-xs text-gray-400">{t('common.loading')}</p>}
          {!payLoading && payableBeneficiaries.length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t('accounting.noPayableBeneficiaries')}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={paySubmitting} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={paySubmitting} className="flex-1">{t('accounting.payCommission')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('accounting.deleteTitle')}
        message={t('accounting.deleteMessage')}
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDeleteTx}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteCatTarget)}
        title={t('accounting.categoryDeleteTitle')}
        message={t('accounting.categoryDeleteMessage', { name: deleteCatTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDeleteCat}
        onCancel={() => setDeleteCatTarget(null)}
      />
    </div>
  );
}
