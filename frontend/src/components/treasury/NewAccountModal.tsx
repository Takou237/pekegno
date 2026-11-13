import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { treasuryApi } from '@/api/treasury.api';
import { scopeApi, type ScopeCountry } from '@/api/scope.api';
import { extractErrorMessage } from '@/api/errors';
import { invalidatePaymentMethods } from '@/components/ui/PaymentMethodOptions';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';

interface NewAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Rappel après création (recharger les caisses). */
  onDone?: () => void;
}

/**
 * « Nouvelle caisse » (administration) : une caisse = un moyen de paiement.
 * On choisit une agence ou l'Administration d'un pays (cahier §2).
 */
export default function NewAccountModal({ isOpen, onClose, onDone }: NewAccountModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [countries, setCountries] = useState<ScopeCountry[]>([]);
  const [loadingScope, setLoadingScope] = useState(false);
  const [form, setForm] = useState({
    target: '',
    name: '',
    type: 'mobile_money' as 'cash' | 'mobile_money' | 'bank',
    account_number: '',
    opening_balance: '',
    visible_to_cashier: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm({ target: '', name: '', type: 'mobile_money', account_number: '', opening_balance: '', visible_to_cashier: false });
    setError(null);
    setLoadingScope(true);
    scopeApi
      .getContext()
      .then((ctx) => setCountries(ctx.countries))
      .catch(() => setCountries([]))
      .finally(() => setLoadingScope(false));
  }, [isOpen]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const [kind, id] = form.target.split(':');
      await treasuryApi.createAccount({
        ...(kind === 'country' ? { country_id: id } : { agency_id: id }),
        name: form.name.trim(),
        type: form.type,
        account_number: form.account_number.trim() || undefined,
        opening_balance: form.opening_balance ? Number(form.opening_balance) : undefined,
        visible_to_cashier: form.visible_to_cashier,
      });
      invalidatePaymentMethods();
      showToast(t('treasury.accountCreated'), 'success');
      onClose();
      onDone?.();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('treasury.newAccount')} maxWidth="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('treasury.newAccountHint')}</p>
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('treasury.accountTarget')} *
          </label>
          <select
            required
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">—</option>
            {loadingScope && <option value="" disabled>{t('common.loading')}</option>}
            <optgroup label={t('treasury.accountAdministrationGroup')}>
              {countries.map((c) => (
                <option key={`country-${c.id}`} value={`country:${c.id}`}>
                  {t('treasury.accountAdministration', { country: c.name })}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('treasury.accountAgencyGroup')}>
              {countries.flatMap((country) =>
                country.agencies.map((a) => (
                  <option key={`agency-${a.id}`} value={`agency:${a.id}`}>
                    {countries.length > 1 ? `${a.name} — ${country.name}` : a.name}
                  </option>
                )),
              )}
            </optgroup>
          </select>
        </div>
        <Input
          label={`${t('treasury.accountName')} *`}
          required
          placeholder="Airtel Money"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('treasury.accountType')} *
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'cash' | 'mobile_money' | 'bank', visible_to_cashier: e.target.value === 'cash' })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="cash">{t('treasury.typeCash')}</option>
            <option value="mobile_money">{t('treasury.typeMobileMoney')}</option>
            <option value="bank">{t('treasury.typeBank')}</option>
          </select>
        </div>
        <Input
          label={t('treasury.accountNumber')}
          value={form.account_number}
          onChange={(e) => setForm({ ...form, account_number: e.target.value })}
        />
        <Input
          label={t('treasury.openingBalance')}
          type="number"
          min="0"
          value={form.opening_balance}
          onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={form.visible_to_cashier}
            onChange={(e) => setForm({ ...form, visible_to_cashier: e.target.checked })}
          />
          {t('treasury.visibleToCashier')}
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={saving} className="flex-1">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
