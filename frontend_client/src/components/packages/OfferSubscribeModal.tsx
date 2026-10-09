import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { clientApi } from '@/api/client.api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { PublicOffer } from '@/types';

function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  if (data?.message) return data.message;
  if (data?.errors) return Object.values(data.errors)[0]?.[0] ?? fallback;
  return fallback;
}

/**
 * Souscription à une offre de prestation — miroir de l'inscription à une
 * formation : le client connecté propose un budget et des dates, la
 * prestation naît « en attente de validation » et le contrat + la facture
 * suivent à la validation par l'agence (payés par preuve depuis
 * « Mes factures »).
 */
export function OfferSubscribeModal({
  offer,
  onClose,
  onDone,
}: {
  offer: PublicOffer;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [budget, setBudget] = useState('');
  const [start, setStart] = useState(todayLocal());
  const [end, setEnd] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Number(budget) > 0 && start !== '' && end !== '' && end >= start && !saving;
  const clientName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.name || user?.email || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.subscribeToOffer(offer.id, {
        budget: Number(budget),
        start_date: start,
        end_date: end,
        description: description.trim() || undefined,
      });
      showToast(t('offers.subscribed'), 'success');
      onDone?.();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`${t('offers.subscribe')} — ${offer.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-gray-500">{t('offers.subscribeHint')}</p>

        <Input label={t('offers.clientLabel')} value={clientName} disabled readOnly />

        <Input
          label={t('offers.budget')}
          type="number"
          min={1}
          required
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('offers.startDate')}
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label={t('offers.endDate')}
            type="date"
            required
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        <Input
          label={t('offers.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {Number(budget) > 0 && (
          <p className="text-right text-sm font-semibold text-gray-900">
            {t('packages.totalLabel')} : {formatCurrency(Number(budget))}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={saving} disabled={!canSubmit}>
            {t('common.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
