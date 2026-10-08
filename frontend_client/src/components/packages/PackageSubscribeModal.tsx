import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { clientApi } from '@/api/client.api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, packagePeriodLabel } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { PublicPackage } from '@/types';

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
 * Même formulaire que la souscription en agence (caissier / commercial),
 * sans le champ « commercial » : le client est l'utilisateur connecté.
 * La preuve de paiement est envoyée après la création de la facture.
 */
export function PackageSubscribeModal({
  packageId,
  pkg,
  onClose,
  onDone,
}: {
  /** Pack de l'agence choisie (les packs homonymes ont chacun leur id). */
  packageId: string;
  pkg: PublicPackage;
  onClose: () => void;
  onDone?: (contractNumber: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [start, setStart] = useState(todayLocal());
  const [periods, setPeriods] = useState('1');
  const [advance, setAdvance] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'om' | 'momo' | 'mobile'>('cash');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aperçu de la preuve de paiement (photo importée).
  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const unitPrice = Number(pkg.effective_price);
  const total = unitPrice * Number(periods || 0);
  // « Nombre de périodes (mois) » — même libellé que la souscription en agence.
  const periodLabel = t(packagePeriodLabel(pkg.billing_period)).replace(/^\s*\/\s*/, '');
  const canSubmit = Number(periods) >= 1 && !saving;
  const clientName =
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.name || user?.email || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await clientApi.subscribeToPackage(packageId, {
        periods: Number(periods),
        start_date: start,
        payment_type: paymentType,
        advance: advance && Number(advance) > 0 ? Number(advance) : undefined,
        auto_renew: autoRenew,
      });

      // Preuve de paiement (photo) : examinée par l'agence avant validation.
      if (proofFile) {
        const form = new FormData();
        form.append('file', proofFile);
        form.append('payment_method', paymentType);
        await clientApi.uploadPaymentProof(res.invoice.id, form).catch(() => undefined);
      }

      showToast(t('packages.subscribed', { contract: res.contract.number }), 'success');
      onDone?.(res.contract.number);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`${t('packages.subscribe')} — ${pkg.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-gray-500">{t('packages.subscribeHint')}</p>

        <Input label={t('packages.clientLabel')} value={clientName} disabled readOnly />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('packages.startDate')}
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label={t('packages.periods', { period: periodLabel })}
            type="number"
            min={1}
            max={60}
            required
            value={periods}
            onChange={(e) => setPeriods(e.target.value)}
          />
          <Input
            label={t('packages.advance')}
            type="number"
            min={0}
            value={advance}
            onChange={(e) => setAdvance(e.target.value)}
          />
          <Select
            label={t('packages.paymentType')}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as typeof paymentType)}
          >
            <option value="cash">Cash</option>
            <option value="om">Orange Money</option>
            <option value="momo">MTN MoMo</option>
            <option value="mobile">Mobile</option>
          </Select>
        </div>

        {/* Preuve de paiement (photo) : examinée par l'agence avant validation. */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">{t('packages.proofHint')}</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-700">
            <Camera className="h-4 w-4" />
            {proofFile ? proofFile.name : t('packages.uploadProof')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                setProofFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
          {proofPreview && (
            <img src={proofPreview} alt={t('packages.paymentProof')} className="max-h-40 rounded-lg border border-gray-200 object-contain" />
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
          {t('packages.autoRenew')}
        </label>

        <p className="text-right text-sm font-semibold text-gray-900">
          {t('packages.totalLabel')} : {formatCurrency(total)}
        </p>

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
