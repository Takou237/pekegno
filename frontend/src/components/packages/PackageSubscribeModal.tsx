import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { todayLocal } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { ClientPicker, CommercialPicker } from '@/components/agencyDept/Pickers';
import type { AgencyPackage } from '@/types/agencyDepartment';

interface PackageSubscribeModalProps {
  pkg: AgencyPackage;
  departmentId?: string;
  onClose: () => void;
  /** Appelé après une souscription réussie avec l'id de la prestation créée. */
  onDone?: (prestationId: string) => void;
}

/**
 * C2 (doc/TODO_Agency.md §2) : souscrire un client à un package depuis le
 * catalogue staff. Réutilisable depuis n'importe quelle page.
 * Encaissement réel : avance + moyen de paiement saisis directement (D — décision).
 */
export function PackageSubscribeModal({ pkg, departmentId, onClose, onDone }: PackageSubscribeModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isCommercial = user?.role?.name === 'commercial';

  const [clientId, setClientId] = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [start, setStart] = useState(todayLocal());
  const [periods, setPeriods] = useState('1');
  const [advance, setAdvance] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'om' | 'momo' | 'mobile'>('cash');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // C2 : pour un commercial, pré-remplir son propre commercial (le backend le force aussi).
  // On affiche son NOM dans le champ lecture seule plutôt qu'un identifiant.
  useEffect(() => {
    if (!isCommercial || !user?.id) return;
    let cancelled = false;
    import('@/api/commercials.api').then(({ commercialsApi }) => {
      commercialsApi
        .list({ per_page: 100 })
        .then((res) => {
          if (cancelled) return;
          const mine = (res.data ?? []).find((c) => c.user_id === user.id);
          if (mine?.id) {
            setCommercialId(mine.id);
            setCommercialName(`${mine.first_name ?? ''} ${mine.last_name ?? ''}`.trim() || (mine.email ?? ''));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [isCommercial, user?.id]);

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

  const total = pkg.effective_price * Number(periods || 0);
  const advanceValue = advance ? Number(advance) : 0;
  // La preuve est obligatoire pour un commercial (le backend la refuse sinon).
  const canSubmit = Boolean(clientId) && Number(periods) >= 1 && (!isCommercial || Boolean(proofFile));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await agencyDeptApi.subscribe(pkg.id, {
        client_id: clientId,
        commercial_id: commercialId || undefined,
        department_id: departmentId,
        start_date: start,
        periods: Number(periods),
        auto_renew: autoRenew,
        advance: advanceValue > 0 ? advanceValue : undefined,
        payment_type: paymentType,
        proof_file: proofFile ?? undefined,
      });
      showToast(t('agencyDept.packages.subscribed', { contract: res.contract.number }), 'success');
      onDone?.(res.prestation.id);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t('agencyDept.packages.subscribe')} — ${pkg.name}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.packages.subscribeHint')}</p>

        <ClientPicker value={clientId} onChange={setClientId} />

        {/* C2 : commercial forcé sur lui-même (affiché par son nom) ; caissier choisit. */}
        {isCommercial ? (
          <Input label={t('agencyDept.commercial')} value={commercialName || commercialId} disabled readOnly />
        ) : (
          <CommercialPicker value={commercialId} onChange={setCommercialId} />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('agencyDept.startDate')}
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label={t('agencyDept.packages.periods', { period: t(`agencyDept.billingPeriod.${pkg.billing_period}`) })}
            type="number"
            min={1}
            max={60}
            required
            value={periods}
            onChange={(e) => setPeriods(e.target.value)}
          />
          <Input
            label={t('agencyDept.packages.advance')}
            type="number"
            min={0}
            value={advance}
            onChange={(e) => setAdvance(e.target.value)}
          />
          <Select
            label={t('agencyDept.packages.paymentType')}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as typeof paymentType)}
          >
            <option value="cash">Cash</option>
            <option value="om">Orange Money</option>
            <option value="momo">MTN MoMo</option>
            <option value="mobile">Mobile</option>
          </Select>
        </div>

        {/* Preuve de paiement (photo) : examinée par le caissier avant validation. */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('invoices.paymentProofHint')}</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-700 dark:border-gray-700 dark:text-gray-400">
            <Camera className="h-4 w-4" />
            {proofFile ? proofFile.name : t('invoices.uploadProof')}
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
            <img src={proofPreview} alt={t('invoices.paymentProof')} className="max-h-40 rounded-lg border border-gray-200 object-contain dark:border-gray-700" />
          )}
          {isCommercial && !proofFile && (
            <p className="text-xs text-error-500">{t('invoices.proofRequiredForSale')}</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
          {t('agencyDept.packages.autoRenew')}
        </label>

        <p className="text-right text-sm font-semibold text-gray-900 dark:text-white">
          {t('agencyDept.total')} : {formatCurrency(total)}
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
