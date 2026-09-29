import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Search } from 'lucide-react';
import { commissionsApi } from '@/api/commissions.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/number';
import { COMMISSION_PAYMENT_METHODS, type CommissionBeneficiary, type CommissionPaymentMethod } from '@/types/commissions';

/**
 * Règlement des commissions au guichet (ticket T4) : la caissière voit le solde
 * dû à chaque vendeur / commercial de son agence et le paie, en tout ou partie.
 * Le backend limite la liste et le paiement à ses agences.
 */
export default function CashierCommissionsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [rows, setRows] = useState<CommissionBeneficiary[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [target, setTarget] = useState<CommissionBeneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CommissionPaymentMethod>('especes');
  const [note, setNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await commissionsApi.summaryBeneficiaries({ search: search.trim() || undefined });
      setRows(res.data ?? []);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('cashierCommissions.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const timer = window.setTimeout(load, 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openPay(row: CommissionBeneficiary) {
    setTarget(row);
    setAmount(String(Number(row.balance ?? 0)));
    setMethod('especes');
    setNote('');
    setPayError(null);
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!target) return;
    setIsPaying(true);
    setPayError(null);
    try {
      await commissionsApi.payCommission({
        beneficiary_type: target.type,
        beneficiary_id: target.id,
        amount: Number(amount),
        payment_method: method,
        note: note.trim() || undefined,
      });
      showToast(t('accounting.commissionPaid'), 'success');
      setTarget(null);
      load();
    } catch (error) {
      setPayError(extractErrorMessage(error, t('accounting.commissionPaymentFailed')));
    } finally {
      setIsPaying(false);
    }
  }

  const methodLabel = (m: CommissionPaymentMethod) =>
    m === 'especes' ? t('payments.cash') : m === 'orange_money' ? t('payments.orangeMoney') : t('payments.mobileMoney');

  const payable = rows.filter((r) => Number(r.balance ?? 0) > 0);
  const totalDue = payable.reduce((s, r) => s + Number(r.balance ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('cashierCommissions.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('cashierCommissions.subtitle')}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('cashierCommissions.totalDue')}</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalDue)}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('cashierCommissions.search')}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : payable.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">{t('cashierCommissions.empty')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('cashierCommissions.beneficiary')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('cashierCommissions.paid')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('cashierCommissions.balance')}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payable.map((r) => (
                <tr key={`${r.type}-${r.id}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.type === 'commercial' ? t('cashierCommissions.commercial') : t('cashierCommissions.seller')}</p>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(r.total_paid)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(r.balance)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button onClick={() => openPay(r)}>
                      <Coins className="h-4 w-4" />
                      {t('cashierCommissions.pay')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={!!target} onClose={() => setTarget(null)} title={t('academy.payCommission')} maxWidth="max-w-md">
        {target && (
          <form onSubmit={handlePay} className="flex flex-col gap-4">
            {payError && <Alert variant="error">{payError}</Alert>}
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {target.name} — {t('cashierCommissions.balance')} : <strong>{formatCurrency(target.balance)}</strong>
            </p>
            <Input
              label={t('cashierCommissions.amount')}
              type="number"
              min="1"
              max={String(target.balance)}
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select label={t('cashierCommissions.method')} value={method} onChange={(e) => setMethod(e.target.value as CommissionPaymentMethod)}>
              {COMMISSION_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{methodLabel(m)}</option>
              ))}
            </Select>
            <Input label={t('cashierCommissions.note')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={isPaying} className="flex-1">{t('common.cancel')}</Button>
              <Button type="submit" isLoading={isPaying} className="flex-1">{t('cashierCommissions.pay')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
