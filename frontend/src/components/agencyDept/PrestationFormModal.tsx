import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { scopeApi, type AgencyOption } from '@/api/scope.api';
import { extractErrorMessage } from '@/api/errors';
import { todayLocal } from '@/utils/date';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CommercialPicker } from './Pickers';
import { EnrollmentLearnerField, emptyNewLearnerForm, isNewLearnerComplete, type LearnerMode, type NewLearnerFormState } from '@/components/academy/EnrollmentLearnerField';
import { clientsApi } from '@/api/clients.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { AgencyCategory, Prestation, PrestationOffer } from '@/types/agencyDepartment';

/**
 * Souscription à une offre de prestation (ou édition d'une souscription) :
 * catégorie et agence héritées de l'offre, le reste (client, période,
 * budget, commission) saisi à la volée.
 */
export function PrestationFormModal({
  isOpen,
  onClose,
  onSaved,
  prestation,
  offer,
  agencyId,
  countryId,
  departmentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (p: Prestation) => void;
  prestation?: Prestation | null;
  /** Offre à laquelle on souscrit : agence, département et catégorie en découlent. */
  offer?: PrestationOffer | null;
  agencyId?: string;
  /** Pays de la page : l'agence est alors choisie dans une liste (hors département). */
  countryId?: string;
  departmentId?: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<AgencyCategory[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [offers, setOffers] = useState<PrestationOffer[]>([]);
  const [form, setForm] = useState({
    name: '',
    offer_id: '',
    category_id: '',
    agency_id: '',
    description: '',
    client_id: '',
    commercial_id: '',
    start_date: todayLocal(),
    end_date: '',
    budget: '',
    commission_type: '' as '' | 'percent' | 'fixed',
    commission_value: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [clientMode, setClientMode] = useState<LearnerMode>('existing');
  const [newClient, setNewClient] = useState<NewLearnerFormState>(emptyNewLearnerForm);
  // Chef d'agence : la souscription part directement en soumission avec le
  // montant encaissé et la preuve de paiement (comme vente / inscription).
  const needsPaymentProof = !prestation && user?.role?.name === 'responsable-agence';
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'om' | 'momo' | 'mobile' | 'wave'>('cash');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  // La prestation appartient toujours à une agence côté backend : le sélecteur
  // est toujours affiché (l'offre peut présélectionner son agence, modifiable
  // seulement à la création — une souscription suit son offre).
  const needsAgencyChoice = !prestation && !offer;
  // « Nouvelle souscription » sans offre présélectionnée : la prestation à
  // souscrire (offre) se choisit dans le formulaire, le backend l'exige.
  const needsOfferChoice = !prestation && !offer;

  useEffect(() => {
    if (!isOpen) return;
    agencyDeptApi
      .categories({ kind: 'prestation', department_id: departmentId, country_id: countryId })
      .then(setCategories)
      .catch(() => {});
    if (needsAgencyChoice) {
      // Vente inter-agences : toutes les agences (du pays de la page le cas échéant).
      scopeApi
        .agencies()
        .then((rows) => setAgencies(countryId ? rows.filter((a) => a.country_id === countryId) : rows))
        .catch(() => {});
    }
    setError(null);
    setClientMode('existing');
    setNewClient(emptyNewLearnerForm);
    setAmountPaid('');
    setPaymentType('cash');
    setProofFile(null);
    setForm({
      name: prestation?.name ?? (!prestation && offer ? offer.name : ''),
      offer_id: offer?.id ?? '',
      category_id: prestation?.category_id ?? offer?.category_id ?? '',
      agency_id: prestation?.agency_id ?? offer?.agency_id ?? agencyId ?? '',
      description: prestation?.description ?? '',
      client_id: prestation?.client_id ?? '',
      commercial_id: prestation?.commercial_id ?? '',
      start_date: prestation?.start_date?.slice(0, 10) ?? todayLocal(),
      end_date: prestation?.end_date?.slice(0, 10) ?? '',
      budget: prestation ? String(Number(prestation.budget)) : '',
      commission_type: prestation?.commission_type ?? '',
      commission_value: prestation?.commission_value ? String(Number(prestation.commission_value)) : '',
    });
  }, [isOpen, prestation, offer, departmentId, countryId, needsAgencyChoice]);

  // Choix de la prestation (offre) à souscrire : offres actives de l'agence.
  useEffect(() => {
    if (!isOpen || !needsOfferChoice) return;
    agencyDeptApi
      .offers({ agency_id: form.agency_id || agencyId, country_id: countryId, is_active: true, per_page: 100, for_sale: true })
      .then((res) => setOffers(res.data ?? []))
      .catch(() => setOffers([]));
  }, [isOpen, needsOfferChoice, form.agency_id, agencyId, countryId]);


  const budgetLocked = !!prestation?.contract_id;

  async function addCategory() {
    if (!newCategory.trim()) return;
    try {
      const c = await agencyDeptApi.createCategory({ kind: 'prestation', name: newCategory.trim(), department_id: departmentId ?? null });
      setCategories((list) => [...list, c]);
      setForm((f) => ({ ...f, category_id: c.id }));
      setNewCategory('');
    } catch (e) {
      setError(extractErrorMessage(e, t('common.error')));
    }
  }

  async function clientOptions(query: string) {
    const rows = await clientsApi.search(query.trim());
    return rows.map((c) => ({
      id: c.id,
      label: c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
      subtitle: c.email,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needsPaymentProof && (!(Number(amountPaid) > 0) || !proofFile)) {
      setError(t('invoices.proofRequiredForSale'));
      return;
    }
    setSaving(true);
    setError(null);
    // Comme l'inscription à une formation : création du client à la volée.
    let resolvedClientId = form.client_id;
    if (!prestation && clientMode === 'new') {
      if (!isNewLearnerComplete(newClient)) {
        setError(t('academy.newLearnerRequired'));
        setSaving(false);
        return;
      }
      try {
        const created = await clientsApi.create({
          first_name: newClient.first_name.trim(),
          last_name: newClient.last_name.trim(),
          email: newClient.email.trim() || undefined,
          phone: newClient.phone.trim() || null,
          city: newClient.city.trim() || undefined,
          country: newClient.country || undefined,
          nationality: newClient.nationality.trim() || undefined,
          quartier: newClient.quartier.trim() || undefined,
          occupation: newClient.occupation.trim() || undefined,
          registered_agency_id: offer?.agency_id ?? form.agency_id ?? agencyId ?? undefined,
        });
        resolvedClientId = created.id;
      } catch (err) {
        setError(extractErrorMessage(err, t('common.error')));
        setSaving(false);
        return;
      }
    }
    const payload = {
      name: form.name,
      category_id: offer ? undefined : form.category_id || null,
      description: form.description || null,
      client_id: resolvedClientId,
      commercial_id: form.commercial_id || null,
      start_date: form.start_date,
      end_date: form.end_date,
      ...(budgetLocked ? {} : { budget: Number(form.budget) }),
      commission_type: prestation?.package_id ? undefined : form.commission_type || null,
      commission_value: prestation?.package_id ? undefined : form.commission_value ? Number(form.commission_value) : null,
    };
    try {
      const saved = prestation
        ? await agencyDeptApi.updatePrestation(prestation.id, payload)
        : await agencyDeptApi.createPrestation({
            ...payload,
            offer_id: offer?.id ?? (form.offer_id || undefined),
            agency_id: offer?.agency_id ?? form.agency_id ?? agencyId,
            department_id: (departmentId ?? offer?.department_id) || undefined,
          });
      if (needsPaymentProof && proofFile) {
        // La souscription est créée : un échec ici la laisse en brouillon, à
        // soumettre depuis sa fiche (« Soumettre avec preuve »).
        try {
          onSaved(
            await agencyDeptApi.submitWithProof(saved.id, {
              amount_paid: Number(amountPaid),
              payment_type: paymentType,
              proof: proofFile,
            }),
          );
        } catch (err) {
          showToast(extractErrorMessage(err, t('common.error')), 'error');
          onSaved(saved);
        }
        return;
      }
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        prestation
          ? t('agencyDept.prestations.edit')
          : t('agencyDept.prestations.newSubscription')
      }
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        {!prestation && offer && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            {t('agencyDept.offers.subscribingTo', { name: offer.name })}
          </p>
        )}
        {!prestation && needsOfferChoice && (
          <div className="sm:max-w-md">
            <Select
              label={t('agencyDept.prestations.selectOffer')}
              required
              value={form.offer_id}
              onChange={(e) => {
                const selected = offers.find((o) => o.id === e.target.value) ?? null;
                setForm((f) => ({
                  ...f,
                  offer_id: e.target.value,
                  name: selected ? selected.name : f.name,
                  category_id: selected?.category_id ?? f.category_id,
                  agency_id: selected?.agency_id ?? f.agency_id,
                }));
              }}
            >
              <option value="">{t('agencyDept.prestations.selectOfferPlaceholder')}</option>
              {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
        )}
        {!prestation && needsAgencyChoice && (
          <div className="sm:max-w-xs">
            <Select
              label={t('agencyDept.agency')}
              required
              value={form.agency_id}
              onChange={(e) => setForm((f) => ({ ...f, agency_id: e.target.value, offer_id: '', category_id: '', name: '' }))}
            >
              <option value="">{t('services.selectAgency')}</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.country_name ? `${a.name} (${a.country_name})` : a.name}</option>)}
            </Select>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('agencyDept.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {!offer && (
            <div className="flex flex-col gap-1.5">
              <Select label={t('agencyDept.category')} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <div className="flex gap-2">
                <Input placeholder={t('agencyDept.newCategory')} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={addCategory}>+</Button>
              </div>
            </div>
          )}
          {!prestation && (
            <div className="sm:col-span-2">
              <EnrollmentLearnerField
                mode={clientMode}
                onModeChange={setClientMode}
                learnerUserId={form.client_id}
                onLearnerUserIdChange={(id) => setForm({ ...form, client_id: id })}
                fetchOptions={clientOptions}
                newLearner={newClient}
                onNewLearnerChange={setNewClient}
                existingLabel={t('agencyDept.clientExisting')}
                createLabel={t('clients.createClient')}
                fieldLabel={`${t('agencyDept.client')} *`}
                searchPlaceholder={t('clients.searchPlaceholder')}
                newInfoLabel={t('clients.createTitle')}
              />
            </div>
          )}
          <CommercialPicker label={t('invoices.seller')} value={form.commercial_id} onChange={(id) => setForm({ ...form, commercial_id: id })} />
          <Input label={t('agencyDept.startDate')} type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label={t('agencyDept.endDate')} type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Input
            label={t('agencyDept.budget.total')}
            type="number"
            min={0}
            required
            disabled={budgetLocked}
            hint={budgetLocked ? t('agencyDept.prestations.budgetLocked') : undefined}
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
        </div>
        {!prestation?.package_id && (
          <div className="grid gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-2 dark:border-gray-800">
            <p className="text-xs text-gray-500 sm:col-span-2 dark:text-gray-400">{t('agencyDept.prestations.commissionHint')}</p>
            <Select label={t('agencyDept.prestations.commissionType')} value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value as typeof form.commission_type })}>
              <option value="">{t('agencyDept.prestations.noCommission')}</option>
              <option value="percent">%</option>
              <option value="fixed">{t('agencyDept.prestations.fixedAmount')}</option>
            </Select>
            <Input label={t('agencyDept.prestations.commissionValue')} type="number" min={0} disabled={!form.commission_type} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
          </div>
        )}
        {needsPaymentProof && (
          <div className="grid gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-2 dark:border-gray-800">
            <p className="text-xs text-gray-500 sm:col-span-2 dark:text-gray-400">{t('agencyDept.submitProof.hint')}</p>
            <Input
              label={t('agencyDept.submitProof.amountPaid')}
              type="number"
              min={0}
              max={form.budget ? Number(form.budget) : undefined}
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
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
              <option value="wave">Wave</option>
            </Select>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('invoices.paymentProof')} <span className="text-error-500">*</span>
              </span>
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
              <p className="text-xs text-gray-400">{t('agencyDept.submitProof.proofHint')}</p>
            </div>
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('agencyDept.description')}
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-gray-700 dark:text-white" />
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" isLoading={saving} disabled={(!prestation && clientMode === 'existing' && !form.client_id) || (needsOfferChoice && !form.offer_id) || (needsPaymentProof && !proofFile)}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
