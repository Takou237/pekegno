import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { treasuryApi } from '@/api/treasury.api';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { Prestation } from '@/types/agencyDepartment';
import type { TreasuryAccount } from '@/types/treasury';

interface SubmitWithProofModalProps {
  prestation: Prestation;
  onClose: () => void;
  /** Appelé après une soumission réussie (avec ou sans preuve). */
  onDone: () => void;
}

/**
 * CM1/CM2 (doc/TODO_Agency.md §4 et §7) : soumettre une prestation avec
 * déclaration du montant encaissé + preuve photo. Réutilisable commercial/caissier.
 * Sans montant, la soumission reste une simple transition de statut.
 */
export function SubmitWithProofModal({ prestation, onClose, onDone }: SubmitWithProofModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'om' | 'momo' | 'mobile'>('cash');
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comptes de trésorerie de l'agence (le caissier en choisit un à l'encaissement).
  useEffect(() => {
    treasuryApi
      .listAccounts({ agency_id: prestation.agency_id })
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [prestation.agency_id]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const total = Number(prestation.budget ?? 0);
  const amountValue = amount ? Number(amount) : 0;
  const withProof = amountValue > 0;

  async function submitWithoutProof() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await agencyDeptApi.transition(prestation.id, 'submit');
      showToast(t('agencyDept.prestations.statusChanged'), 'success');
      onDone();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  async function submitWithProof() {
    if (saving || !proofFile) return;
    setSaving(true);
    setError(null);
    try {
      await agencyDeptApi.submitWithProof(prestation.id, {
        amount_paid: amountValue,
        payment_type: paymentType,
        treasury_account_id: treasuryAccountId || undefined,
        proof: proofFile,
      });
      showToast(t('agencyDept.submitProof.done'), 'success');
      onDone();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={t('agencyDept.submitProof.title')} maxWidth="max-w-lg">
      <div className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.submitProof.hint')}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('agencyDept.submitProof.amountPaid')}
            type="number"
            min={0}
            max={total}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
          {accounts.length > 0 && (
            <Select
              label={t('agencyDept.submitProof.treasuryAccount')}
              value={treasuryAccountId}
              onChange={(e) => setTreasuryAccountId(e.target.value)}
            >
              <option value="">{t('invoices.selectTreasuryAccount')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          )}
          <p className="self-end text-right text-sm font-semibold text-gray-900 dark:text-white sm:col-span-2">
            {t('agencyDept.total')} : {formatCurrency(total)}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.submitProof.proofHint')}</p>
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
          {withProof && !proofFile && (
            <p className="text-xs text-error-500">{t('agencyDept.submitProof.amountRequiresProof')}</p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {withProof ? (
            <Button type="button" isLoading={saving} disabled={!proofFile} onClick={submitWithProof}>
              {t('agencyDept.submitProof.withProof')}
            </Button>
          ) : (
            <Button type="button" isLoading={saving} onClick={submitWithoutProof}>
              {t('agencyDept.submitProof.withoutProof')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}