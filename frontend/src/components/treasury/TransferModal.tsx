import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { treasuryApi } from '@/api/treasury.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { TreasuryAccount, TreasuryAccountType, TransferType } from '@/types/treasury';

/**
 * Transferts du cahier §2 (mêmes règles que le serveur, TreasuryService) :
 * O / M → B et C → B (versement en banque), O → C (retrait), C → administration
 * (décaissement administratif). Un transfert n'est ni une vente ni une dépense.
 */
export const TRANSFER_TYPES: { value: TransferType; label: string; hint: string; from: TreasuryAccountType[] | null; to: TreasuryAccountType[] | null }[] = [
  { value: 'bank_deposit', label: 'treasury.transferBankDeposit', hint: 'treasury.transferBankDepositHint', from: ['cash', 'mobile_money'], to: ['bank'] },
  { value: 'withdrawal', label: 'treasury.transferWithdrawal', hint: 'treasury.transferWithdrawalHint', from: ['mobile_money'], to: ['cash'] },
  { value: 'admin_disbursement', label: 'treasury.transferAdminDisbursement', hint: 'treasury.transferAdminDisbursementHint', from: ['cash'], to: null },
  { value: 'internal', label: 'treasury.transferInternal', hint: 'treasury.transferInternalHint', from: null, to: null },
];

export const TRANSFER_LABELS: Record<string, string> = Object.fromEntries(TRANSFER_TYPES.map((tt) => [tt.value, tt.label]));

function accountName(a: TreasuryAccount): string {
  return `${a.code ? `${a.code} · ` : ''}${a.name}${a.agency?.name ? ` — ${a.agency.name}` : ''}`;
}


interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Rappel après un transfert réussi (recharger les soldes). */
  onDone?: () => void;
}

/**
 * Transfert d'une caisse à une autre (versement en banque, retrait,
 * décaissement administratif, transfert interne). Partagé par la Trésorerie
 * et « Caisses du jour ».
 */
export default function TransferModal({ isOpen, onClose, onDone }: TransferModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLabel, setTransferLabel] = useState('');
  const [transferType, setTransferType] = useState<TransferType>('bank_deposit');
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTransferFrom('');
    setTransferTo('');
    setTransferAmount('');
    setTransferLabel('');
    setTransferType('bank_deposit');
    setTransferErrors({});
    treasuryApi.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [isOpen]);

  const route = TRANSFER_TYPES.find((tt) => tt.value === transferType) ?? TRANSFER_TYPES[TRANSFER_TYPES.length - 1];
  const sourceAccounts = accounts.filter((a) => a.is_active && (route.from === null || route.from.includes(a.type)));
  const targetAccounts = accounts.filter((a) => a.is_active && a.id !== transferFrom && (route.to === null || route.to.includes(a.type)));

  function changeTransferType(value: TransferType) {
    setTransferType(value);
    setTransferFrom('');
    setTransferTo('');
    setTransferErrors({});
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
        transfer_type: transferType,
      });
      showToast(t('treasury.transferSuccess'), 'success');
      onClose();
      onDone?.();
    } catch (error) {
      setTransferErrors({ general: extractErrorMessage(error, t('treasury.transferFailed')) });
    } finally {
      setTransferSubmitting(false);
    }
  }

  return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('treasury.transferTitle')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleTransfer} className="flex flex-col gap-4">
          {transferErrors.general && <Alert variant="error">{transferErrors.general}</Alert>}
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            {t('treasury.transferNotSale')}
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('treasury.transferType')}</span>
            {TRANSFER_TYPES.map((tt) => (
              <label
                key={tt.value}
                className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2 text-sm ${
                  transferType === tt.value
                    ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="transfer_type"
                  className="mt-1"
                  checked={transferType === tt.value}
                  onChange={() => changeTransferType(tt.value)}
                />
                <span>
                  <span className="block font-medium text-gray-800 dark:text-gray-100">{t(tt.label)}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{t(tt.hint)}</span>
                </span>
              </label>
            ))}
          </div>
          <Select
            label={t('treasury.fromAccount')}
            required
            value={transferFrom}
            onChange={(e) => { setTransferFrom(e.target.value); if (e.target.value === transferTo) setTransferTo(''); }}
            error={transferErrors.from_account_id ?? (sourceAccounts.length === 0 ? t('treasury.transferNoSource') : undefined)}
          >
            <option value="">{t('treasury.selectTreasuryAccount')}</option>
            {sourceAccounts.map((a) => (
              <option key={a.id} value={a.id}>{accountName(a)} ({formatCurrency(a.balance)})</option>
            ))}
          </Select>
          <Select
            label={t('treasury.toAccount')}
            required
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            error={transferErrors.to_account_id ?? (transferFrom && targetAccounts.length === 0 ? t('treasury.transferNoTarget') : undefined)}
          >
            <option value="">{t('treasury.selectTreasuryAccount')}</option>
            {targetAccounts.map((a) => (
              <option key={a.id} value={a.id}>{accountName(a)} ({formatCurrency(a.balance)})</option>
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={transferSubmitting} className="flex-1">
              {t('treasury.transfer')}
            </Button>
          </div>
        </form>
      </Modal>
  );
}
