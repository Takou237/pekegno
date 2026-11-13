import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import TransferModal from '@/components/treasury/TransferModal';
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
import type { CashClosing, CashDayBreakdown, CashJourney, TreasuryAccount } from '@/types/treasury';

function signed(value: number): string {
  if (value === 0) return '—';
  return `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;
}

/** Journée d'une caisse (cahier §2) : initial, entrées, sorties, transferts, théorique. */
function DayBreakdown({ day, t }: { day: CashDayBreakdown; t: (key: string) => string }) {
  const rows: [string, string, string][] = [
    [t('treasury.openingBalance'), formatCurrency(day.opening), 'text-gray-700 dark:text-gray-200'],
    [t('bilans.cashIn'), signed(day.in), 'text-success-600'],
    [t('bilans.cashOut'), signed(-day.out), 'text-red-600 dark:text-red-400'],
    [t('treasury.transfersIn'), signed(day.transfer_in), 'text-blue-600 dark:text-blue-400'],
    [t('treasury.transfersOut'), signed(-day.transfer_out), 'text-blue-600 dark:text-blue-400'],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
      {rows.map(([label, value, color]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className={`text-right ${color}`}>{value}</dd>
        </div>
      ))}
      <dt className="border-t border-gray-100 pt-1 font-medium text-gray-700 dark:border-gray-800 dark:text-gray-200" title={t('treasury.theoreticalFormula')}>
        {t('treasury.theoreticalBalance')}
      </dt>
      <dd className="border-t border-gray-100 pt-1 text-right font-semibold text-gray-900 dark:border-gray-800 dark:text-white">{formatCurrency(day.closing)}</dd>
    </dl>
  );
}

export default function CashClosingsPage() {
  const { t } = useTranslation();
  // Administration (super-admin, direction, chefs d'agence et de département) :
  // transfert d'une caisse à une autre depuis les caisses du jour.
  const { user } = useAuth();
  const canTransfer = ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'].includes(user?.role?.name ?? '');
  const [transferOpen, setTransferOpen] = useState(false);
  const { showToast } = useToast();

  const [date, setDate] = useState(todayLocal());
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [days, setDays] = useState<Record<string, CashJourney>>({});
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [closingAccount, setClosingAccount] = useState<TreasuryAccount | null>(null);
  const [actualBalance, setActualBalance] = useState('');
  const [justification, setJustification] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      treasuryApi.listAccounts(),
      treasuryApi.listClosings({ date }),
    ])
      .then(async ([accountsData, closingsData]) => {
        setAccounts(accountsData);
        setClosings(closingsData);
        // Journée de chaque caisse à la date choisie (pas le solde du moment).
        const breakdowns = await Promise.all(
          accountsData.map((a) => treasuryApi.closingDay({ treasury_account_id: a.id }).catch(() => null)),
        );
        setDays(Object.fromEntries(breakdowns.filter((d) => d !== null).map((d) => [d.treasury_account_id, d])));
      })
      .catch((error) => showToast(extractErrorMessage(error, t('common.error')), 'error'))
      .finally(() => setLoading(false));
  }, [date, showToast, t]);

  useEffect(() => { load(); }, [load]);

  function openClosing(account: TreasuryAccount) {
    setClosingAccount(account);
    setActualBalance(String(days[account.id]?.closing ?? account.balance));
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

  async function handleReopen(account: TreasuryAccount) {
    setReopeningId(account.id);
    try {
      await treasuryApi.reopenCash(account.id);
      showToast(t('treasury.reopenSuccess'), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setReopeningId(null);
    }
  }

  const when = (iso: string | null) => (iso ? formatDateTimeFr(iso) : null);

  // Une caisse C, O, M… par agence : on regroupe les cartes sous le nom de l'agence.
  const byAgency = accounts.reduce<{ key: string; name: string; accounts: TreasuryAccount[] }[]>((groups, account) => {
    const key = account.agency_id ?? 'none';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, name: account.agency?.name ?? t('treasury.noAgency'), accounts: [] };
      groups.push(group);
    }
    group.accounts.push(account);
    return groups;
  }, []);

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
          {canTransfer && (
            <Button onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" />
              {t('treasury.transfer')}
            </Button>
          )}
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('treasury.noAccounts')}</p>
        ) : (
          byAgency.map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{group.name}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {group.accounts.map((account) => {
            const journey = days[account.id];
            const closed = journey?.is_closed ?? false;
            return (
              <div key={account.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {account.code && (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{account.code}</span>
                  )}
                  <span>{account.name}</span>
                </div>
                {journey && (
                  <p className={`text-xs ${closed ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {closed
                      ? t('treasury.closedSince', { date: when(journey.closed_at) })
                      : journey.since
                        ? t('treasury.openSince', { date: when(journey.since) })
                        : t('treasury.neverClosed')}
                  </p>
                )}
                {journey ? (
                  <DayBreakdown day={journey} t={t} />
                ) : (
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(account.balance)}</p>
                )}
                {closed ? (
                  <Button variant="outline" onClick={() => handleReopen(account)} isLoading={reopeningId === account.id}>
                    <CheckCircle2 className="h-4 w-4" />
                    {t('treasury.reopenCash')}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => openClosing(account)}>
                    <Lock className="h-4 w-4" />
                    {t('treasury.closeCash')}
                  </Button>
                )}
              </div>
            );
          })}
            </div>
          </section>
          ))
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
                  <th className="py-2 pr-3 font-medium">{t('bilans.cashIn')}</th>
                  <th className="py-2 pr-3 font-medium">{t('bilans.cashOut')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.transfers')}</th>
                  <th className="py-2 pr-3 font-medium" title={t('treasury.theoreticalFormula')}>{t('treasury.theoreticalBalance')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.actualBalance')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.difference')}</th>
                  <th className="py-2 pr-3 font-medium">{t('treasury.justification')}</th>
                  <th className="py-2 font-medium">{t('treasury.closedBy')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {closings.map((closing) => (
                  <tr key={closing.id}>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      {closing.account?.code ? `${closing.account.code} · ` : ''}{closing.account?.name ?? '—'}
                      {closing.account?.agency?.name && (
                        <span className="block text-xs text-gray-400">{closing.account.agency.name}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(closing.opening_balance)}</td>
                    <td className="py-2 pr-3 text-success-600">{closing.breakdown ? signed(closing.breakdown.in) : '—'}</td>
                    <td className="py-2 pr-3 text-red-600 dark:text-red-400">{closing.breakdown ? signed(-closing.breakdown.out) : '—'}</td>
                    <td className="py-2 pr-3 text-blue-600 dark:text-blue-400">
                      {closing.breakdown && (closing.breakdown.transfer_in > 0 || closing.breakdown.transfer_out > 0) ? (
                        <span className="flex flex-col leading-tight">
                          {closing.breakdown.transfer_in > 0 && <span>{signed(closing.breakdown.transfer_in)}</span>}
                          {closing.breakdown.transfer_out > 0 && <span>{signed(-closing.breakdown.transfer_out)}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(closing.theoretical_balance)}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(closing.actual_balance)}</td>
                    <td className={`py-2 pr-3 font-medium ${
                      Number(closing.difference) === 0 ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(closing.difference)}
                    </td>
                    <td className="max-w-[16rem] py-2 pr-3 text-xs text-gray-500 dark:text-gray-400">{closing.justification ?? '—'}</td>
                    {/* Plus de validation : la caissière clôture simplement (11/11). */}
                    <td className="py-2 text-xs text-gray-500 dark:text-gray-400">
                      {[closing.closer?.first_name, closing.closer?.last_name].filter(Boolean).join(' ') || closing.closer?.name || '—'}
                      {closing.closed_at && <span className="block">{formatDateTimeFr(closing.closed_at)}</span>}
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
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {closingAccount?.code ? `${closingAccount.code} · ` : ''}{closingAccount?.name}
            {closingAccount?.agency?.name ? ` (${closingAccount.agency.name})` : ''}
            {' — '}
            {closingAccount && days[closingAccount.id]?.since
              ? t('treasury.openSince', { date: when(days[closingAccount.id].since) })
              : t('treasury.neverClosed')}
          </p>
          <Alert variant="info">{t('treasury.closeCashWarning')}</Alert>
          {closingAccount && days[closingAccount.id] && (
            <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <DayBreakdown day={days[closingAccount.id]} t={t} />
            </div>
          )}
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
      <TransferModal isOpen={transferOpen} onClose={() => setTransferOpen(false)} onDone={load} />
    </div>
  );
}
