import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { treasuryApi } from '@/api/treasury.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { formatDateTimeFr, todayLocal } from '@/utils/date';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { CashClosing, TreasuryAccount } from '@/types/treasury';

const TYPE_ICONS: Record<string, string> = {
  cash: '💵',
  mobile_money: '📱',
  bank: '🏦',
};

export default function CashClosingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [date, setDate] = useState(todayLocal());
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [loading, setLoading] = useState(true);

  const [closingAccount, setClosingAccount] = useState<TreasuryAccount | null>(null);
  const [actualBalance, setActualBalance] = useState('');
  const [justification, setJustification] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      treasuryApi.listAccounts(),
      treasuryApi.listClosings({ date }),
    ])
      .then(([accountsData, closingsData]) => {
        setAccounts(accountsData);
        setClosings(closingsData);
      })
      .catch((error) => showToast(extractErrorMessage(error, t('common.error')), 'error'))
      .finally(() => setLoading(false));
  }, [date, showToast, t]);

  useEffect(() => { load(); }, [load]);

  function openClosing(account: TreasuryAccount) {
    setClosingAccount(account);
    setActualBalance(String(account.balance));
    setJustification('');
    setFormError('');
  }

  async function handleClose(e: FormEvent) {
    e.preventDefault();
    if (!closingAccount) return;

    const actual = Number(actualBalance);
    if (Number.isNaN(actual) || actual < 0) {
      setFormError(t('common.required'));
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await treasuryApi.closeCash({
        treasury_account_id: closingAccount.id,
        closing_date: date,
        actual_balance: actual,
        justification: justification || undefined,
      });
      showToast(t('treasury.closeSuccess'), 'success');
      setClosingAccount(null);
      load();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('treasury.closeFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidate(closing: CashClosing) {
    setValidatingId(closing.id);
    try {
      await treasuryApi.validateClosing(closing.id);
      showToast(t('treasury.statusValidated'), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setValidatingId(null);
    }
  }

  const closedAccountIds = new Set(closings.map((c) => c.treasury_account_id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('treasury.dailyClosings')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('treasury.closingSubtitle')}</p>
        </div>
        <div className="flex items-end gap-3">
          <Input
            label={t('treasury.closingDate')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-8"><Spinner /></div>
        ) : accounts.length === 0 ? (
          <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">{t('treasury.noAccounts')}</p>
        ) : (
          accounts.map((account) => {
            const closed = closedAccountIds.has(account.id);
            return (
              <div key={account.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{TYPE_ICONS[account.type] ?? '💰'}</span>
                  <span>{account.code ? `${account.code} · ` : ''}{account.name}</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(account.balance)}</p>
                {closed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('treasury.statusClosed')}
                  </span>
                ) : (
                  <Button variant="outline" onClick={() => openClosing(account)}>
                    <Lock className="h-4 w-4" />
                    {t('treasury.closeCash')}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : closings.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('treasury.noClosings')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('treasury.account')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.openingBalance')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.theoreticalBalance')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.actualBalance')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.difference')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.justification')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.status')}</th>
                  <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {closings.map((closing) => (
                  <tr key={closing.id}>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      {closing.account?.code ? `${closing.account.code} · ` : ''}{closing.account?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(closing.opening_balance)}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(closing.theoretical_balance)}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(closing.actual_balance)}</td>
                    <td className={`py-2 pr-3 font-medium ${
                      Number(closing.difference) === 0 ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(closing.difference)}
                    </td>
                    <td className="max-w-[16rem] py-2 pr-3 text-xs text-gray-500 dark:text-gray-400">{closing.justification ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        closing.status === 'validated'
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                      }`}>
                        {closing.status === 'validated' ? t('treasury.statusValidated') : t('treasury.statusClosed')}
                      </span>
                      {closing.validated_at && (
                        <p className="mt-1 text-xs text-gray-400">{formatDateTimeFr(closing.validated_at)}</p>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {closing.status !== 'validated' && (
                        <Button
                          variant="outline"
                          onClick={() => handleValidate(closing)}
                          isLoading={validatingId === closing.id}
                        >
                          {t('treasury.validate')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={closingAccount !== null}
        onClose={() => setClosingAccount(null)}
        title={t('treasury.closeCash')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleClose} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {closingAccount?.code ? `${closingAccount.code} · ` : ''}{closingAccount?.name}
            {' — '}
            {t('treasury.balance')} : {formatCurrency(closingAccount?.balance ?? 0)}
          </p>
          <Input
            label={t('treasury.actualBalance')}
            type="number"
            min={0}
            step="0.01"
            required
            value={actualBalance}
            onChange={(e) => setActualBalance(e.target.value)}
          />
          <Input
            label={t('treasury.justification')}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={t('treasury.closeRequiredJustification')}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setClosingAccount(null)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={submitting} className="flex-1">
              {t('treasury.closeCash')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
