import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { treasuryApi } from '@/api/treasury.api';
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
import type { TreasuryAccount, TreasuryDirection, TreasuryTransaction } from '@/types/treasury';
import type { PaginationMeta } from '@/types/agency';

const TYPE_ICONS: Record<string, string> = {
  cash: '💵',
  mobile_money: '📱',
  bank: '🏦',
};

export default function TreasuryPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [txMeta, setTxMeta] = useState<PaginationMeta | null>(null);
  const [txLoading, setTxLoading] = useState(true);

  const [filterAccount, setFilterAccount] = useState('');
  const [filterDirection, setFilterDirection] = useState<TreasuryDirection | ''>('');
  const [txPage, setTxPage] = useState(1);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLabel, setTransferLabel] = useState('');
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const loadAccounts = useCallback(() => {
    setAccountsLoading(true);
    treasuryApi.listAccounts()
      .then((data) => {
        setAccounts(data);
        setTotalBalance(data.reduce((sum, a) => sum + a.balance, 0));
      })
      .catch(() => {})
      .finally(() => setAccountsLoading(false));
  }, []);

  const loadTransactions = useCallback(() => {
    setTxLoading(true);
    treasuryApi.listTransactions({
      treasury_account_id: filterAccount || undefined,
      direction: filterDirection || undefined,
      page: txPage,
      per_page: 15,
    })
      .then((res) => {
        setTransactions(res.data);
        setTxMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, per_page: res.per_page });
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [filterAccount, filterDirection, txPage]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  function openTransfer() {
    setTransferFrom('');
    setTransferTo('');
    setTransferAmount('');
    setTransferLabel('');
    setTransferErrors({});
    setTransferOpen(true);
  }

  async function handleTransfer(e: FormEvent) {
    e.preventDefault();
    const amount = Number(transferAmount);
    if (!amount || amount <= 0) {
      setTransferErrors({ amount: t('common.required') });
      return;
    }
    if (transferFrom === transferTo) {
      setTransferErrors({ to_account_id: t('treasury.transferFailed') });
      return;
    }
    setTransferSubmitting(true);
    setTransferErrors({});
    try {
      await treasuryApi.transfer({
        from_account_id: transferFrom,
        to_account_id: transferTo,
        amount,
        label: transferLabel || undefined,
      });
      showToast(t('treasury.transferSuccess'), 'success');
      setTransferOpen(false);
      loadAccounts();
      loadTransactions();
    } catch (error) {
      setTransferErrors({ general: extractErrorMessage(error, t('treasury.transferFailed')) });
    } finally {
      setTransferSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('treasury.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('treasury.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { loadAccounts(); loadTransactions(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openTransfer}>
            <ArrowLeftRight className="h-4 w-4" />
            {t('treasury.transfer')}
          </Button>
        </div>
      </div>

      {/* Account cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accountsLoading ? (
          <div className="col-span-full flex justify-center py-8"><Spinner /></div>
        ) : accounts.length === 0 ? (
          <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">{t('treasury.noAccounts')}</p>
        ) : (
          <>
            {accounts.map((a) => (
              <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{TYPE_ICONS[a.type] ?? '💰'}</span>
                  <span>{a.name}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(a.balance)}
                </p>
                {a.agency && (
                  <p className="mt-1 text-xs text-gray-400">{a.agency?.name ?? ''}</p>
                )}
              </div>
            ))}
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{t('treasury.totalBalance')}</p>
              <p className="mt-2 text-2xl font-bold text-brand-700 dark:text-brand-300">
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Transactions */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            label={t('treasury.filterByAccount')}
            value={filterAccount}
            onChange={(e) => { setFilterAccount(e.target.value); setTxPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select
            label={t('treasury.filterByDirection')}
            value={filterDirection}
            onChange={(e) => { setFilterDirection(e.target.value as TreasuryDirection | ''); setTxPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            <option value="in">{t('treasury.directionIn')}</option>
            <option value="out">{t('treasury.directionOut')}</option>
          </Select>
        </div>

        {txLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('treasury.noTransactions')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('treasury.date')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.direction')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.accounts')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.label')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.reference')}</th>
                  <th className="py-2 text-right font-medium">{t('treasury.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {new Date(tx.transacted_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        tx.direction === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tx.direction === 'in' ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                        {tx.direction === 'in' ? t('treasury.directionIn') : t('treasury.directionOut')}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {tx.account?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      {tx.label}
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-400">
                      {tx.reference ?? '—'}
                    </td>
                    <td className={`py-2 text-right font-medium ${
                      tx.direction === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {tx.direction === 'in' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {txMeta && txMeta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={txMeta.current_page}
              lastPage={txMeta.last_page}
              total={txMeta.total}
              perPage={txMeta.per_page}
              onPageChange={setTxPage}
            />
          </div>
        )}
      </div>

      {/* Transfer modal */}
      <Modal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={t('treasury.transferTitle')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleTransfer} className="flex flex-col gap-4">
          {transferErrors.general && <Alert variant="error">{transferErrors.general}</Alert>}
          <Select
            label={t('treasury.fromAccount')}
            required
            value={transferFrom}
            onChange={(e) => setTransferFrom(e.target.value)}
            error={transferErrors.from_account_id}
          >
            <option value="">{t('treasury.selectTreasuryAccount')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
            ))}
          </Select>
          <Select
            label={t('treasury.toAccount')}
            required
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            error={transferErrors.to_account_id}
          >
            <option value="">{t('treasury.selectTreasuryAccount')}</option>
            {accounts.filter((a) => a.id !== transferFrom).map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
            ))}
          </Select>
          <Input
            label={t('treasury.amount')}
            type="number"
            min={0.01}
            step="0.01"
            required
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            error={transferErrors.amount}
          />
          <Input
            label={t('treasury.label')}
            value={transferLabel}
            onChange={(e) => setTransferLabel(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={transferSubmitting} className="flex-1">
              {t('treasury.transfer')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
