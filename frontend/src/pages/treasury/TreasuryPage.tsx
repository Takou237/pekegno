import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, RefreshCw, Plus, Power } from 'lucide-react';
import { agenciesApi } from '@/api/agencies.api';
import { useAuth } from '@/hooks/useAuth';
import { invalidatePaymentMethods } from '@/components/ui/PaymentMethodOptions';
import { treasuryApi } from '@/api/treasury.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { formatDateTimeFr } from '@/utils/date';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import type { TreasuryAccount, TreasuryDirection, TreasuryTransaction } from '@/types/treasury';
import type { PaginationMeta } from '@/types/agency';
import TransferModal, { TRANSFER_LABELS } from '@/components/treasury/TransferModal';


function accountName(a: TreasuryAccount): string {
  return `${a.code ? `${a.code} · ` : ''}${a.name}${a.agency?.name ? ` — ${a.agency.name}` : ''}`;
}

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
  const [filterKind, setFilterKind] = useState<'' | 'transfer' | 'movement'>('');
  const [txPage, setTxPage] = useState(1);

  // Nouvelle caisse (administration) : crée aussi le moyen de paiement.
  const { user } = useAuth();
  // Seul l'administrateur (super-admin) crée et désactive les caisses.
  const canManageAccounts = user?.role?.name === 'super-admin';
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [agencyOptions, setAgencyOptions] = useState<{ id: string; name: string }[]>([]);
  const [newAccount, setNewAccount] = useState({ agency_id: '', name: '', type: 'mobile_money' as 'cash' | 'mobile_money' | 'bank', account_number: '', opening_balance: '', visible_to_cashier: false });
  const [newAccountError, setNewAccountError] = useState<string | null>(null);
  const [newAccountSaving, setNewAccountSaving] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);

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
      kind: filterKind || undefined,
      page: txPage,
      per_page: 15,
    })
      .then((res) => {
        setTransactions(res.data);
        setTxMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, per_page: res.per_page });
      })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [filterAccount, filterDirection, filterKind, txPage]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  function openTransfer() {
    setTransferOpen(true);
  }

  function openNewAccount() {
    setNewAccountError(null);
    setNewAccount({ agency_id: '', name: '', type: 'mobile_money', account_number: '', opening_balance: '', visible_to_cashier: false });
    setNewAccountOpen(true);
    if (agencyOptions.length === 0) {
      agenciesApi.list({ per_page: 100 }).then((res) => setAgencyOptions(res.data.map((a) => ({ id: a.id, name: a.name })))).catch(() => {});
    }
  }

  async function submitNewAccount(e: FormEvent) {
    e.preventDefault();
    setNewAccountSaving(true);
    setNewAccountError(null);
    try {
      await treasuryApi.createAccount({
        agency_id: newAccount.agency_id,
        name: newAccount.name.trim(),
        type: newAccount.type,
        account_number: newAccount.account_number.trim() || undefined,
        opening_balance: newAccount.opening_balance ? Number(newAccount.opening_balance) : undefined,
        visible_to_cashier: newAccount.visible_to_cashier,
      });
      invalidatePaymentMethods();
      showToast(t('treasury.accountCreated'), 'success');
      setNewAccountOpen(false);
      loadAccounts();
    } catch (error) {
      setNewAccountError(extractErrorMessage(error, t('common.error')));
    } finally {
      setNewAccountSaving(false);
    }
  }

  async function toggleAccount(account: TreasuryAccount) {
    try {
      await treasuryApi.updateAccount(account.id, { is_active: !account.is_active });
      invalidatePaymentMethods();
      loadAccounts();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('treasury.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('treasury.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => { loadAccounts(); loadTransactions(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canManageAccounts && (
            <Button variant="outline" onClick={openNewAccount}>
              <Plus className="h-4 w-4" />
              {t('treasury.newAccount')}
            </Button>
          )}
          <Button onClick={openTransfer}>
            <ArrowLeftRight className="h-4 w-4" />
            {t('treasury.transfer')}
          </Button>
        </div>
      </div>

      {/* Account cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {accountsLoading ? (
          <div className="col-span-full flex justify-center py-8"><Spinner /></div>
        ) : accounts.length === 0 ? (
          <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">{t('treasury.noAccounts')}</p>
        ) : (
          <>
            {accounts.map((a) => (
              <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {a.code && (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{a.code}</span>
                  )}
                  <span>{a.name}</span>
                  {canManageAccounts && (
                    <button
                      type="button"
                      onClick={() => toggleAccount(a)}
                      className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title={t('treasury.deactivateAccount')}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">
                  {formatCurrency(a.balance)}
                </p>
                {a.agency && (
                  <p className="mt-1 text-xs text-gray-400">{a.agency?.name ?? ''}</p>
                )}
              </div>
            ))}
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{t('treasury.totalBalance')}</p>
              <p className="mt-2 text-lg font-bold sm:text-2xl text-brand-700 dark:text-brand-300">
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
          <Select
            label={t('treasury.filterByKind')}
            value={filterKind}
            onChange={(e) => { setFilterKind(e.target.value as '' | 'transfer' | 'movement'); setTxPage(1); }}
          >
            <option value="">{t('treasury.kindAll')}</option>
            <option value="transfer">{t('treasury.kindTransfer')}</option>
            <option value="movement">{t('treasury.kindMovement')}</option>
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
                      {/* Date + heure dans la même colonne (ex. 15/10/2026 à 10h30) */}
                      {formatDateTimeFr(tx.transacted_at)}
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
                      {tx.account ? accountName(tx.account) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      {tx.source_type === 'transfer' && (
                        <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          <ArrowLeftRight className="h-3 w-3" />
                          {t(TRANSFER_LABELS[tx.transfer_type ?? 'internal'] ?? 'treasury.transferBadge')}
                        </span>
                      )}
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
      <Modal isOpen={newAccountOpen} onClose={() => setNewAccountOpen(false)} title={t('treasury.newAccount')} maxWidth="max-w-md">
        <form onSubmit={submitNewAccount} className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('treasury.newAccountHint')}</p>
          {newAccountError && <Alert variant="error">{newAccountError}</Alert>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('treasury.accountAgency')} *</label>
            <select required value={newAccount.agency_id} onChange={(e) => setNewAccount({ ...newAccount, agency_id: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="">—</option>
              {agencyOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Input label={`${t('treasury.accountName')} *`} required placeholder="Airtel Money" value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('treasury.accountType')} *</label>
            <select value={newAccount.type} onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as 'cash' | 'mobile_money' | 'bank', visible_to_cashier: e.target.value === 'cash' })} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              <option value="cash">{t('treasury.typeCash')}</option>
              <option value="mobile_money">{t('treasury.typeMobileMoney')}</option>
              <option value="bank">{t('treasury.typeBank')}</option>
            </select>
          </div>
          <Input label={t('treasury.accountNumber')} value={newAccount.account_number} onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })} />
          <Input label={t('treasury.openingBalance')} type="number" min="0" value={newAccount.opening_balance} onChange={(e) => setNewAccount({ ...newAccount, opening_balance: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={newAccount.visible_to_cashier} onChange={(e) => setNewAccount({ ...newAccount, visible_to_cashier: e.target.checked })} />
            {t('treasury.visibleToCashier')}
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setNewAccountOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={newAccountSaving} className="flex-1">{t('common.create')}</Button>
          </div>
        </form>
      </Modal>

      <TransferModal isOpen={transferOpen} onClose={() => setTransferOpen(false)} onDone={() => { loadAccounts(); loadTransactions(); }} />
    </div>
  );
}
