import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
import { servicesApi } from '@/api/services.api';
import { academyApi, type Course } from '@/api/academy.api';
import { commercialsApi } from '@/api/commercials.api';
import { employeesApi } from '@/api/employees.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/number';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import {
  EnrollmentLearnerField,
  emptyNewLearnerForm,
  type LearnerMode,
  type NewLearnerFormState,
} from '@/components/academy/EnrollmentLearnerField';
import { Alert } from '@/components/ui/Alert';
import type { PaymentMethod } from '@/types/invoice';
import type { SeminarTier, Service } from '@/types/service';
import type { Commercial } from '@/types/commercial';
import { useAgencyCurrency } from '@/hooks/useAgencyCurrency';

interface InvoiceLineDraft {
  key: string;
  service_id: string;
  label: string;
  unit_price: string;
  quantity: string;
  pass_tier: string;
  kind: 'service' | 'formation' | '';
}

let lineCounter = 0;
function newLine(): InvoiceLineDraft {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, service_id: '', label: '', unit_price: '', quantity: '1', pass_tier: '', kind: '' };
}

const FORMATION_PREFIX = 'formation:';

/** Entrée de la liste déroulante « Produit » : un produit du catalogue ou une formation. */
interface ProductOption {
  value: string;
  label: string;
  price: number;
  tiers: SeminarTier[];
  isCourse: boolean;
}

interface QuickSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencyId?: string;
}

export default function QuickSaleModal({ isOpen, onClose, agencyId }: QuickSaleModalProps) {
  const currency = useAgencyCurrency(agencyId);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isCommercial = currentUser?.role?.name === 'commercial';
  // Caissier / admin (super-admin, direction-generale) sont des validateurs :
  // une vente de guichet qu'ils saisissent est validée directement, donc le
  // vendeur par défaut est leur propre compte et aucune preuve de paiement
  // n'est exigée pour OM/MoMo (contrairement à un commercial).
  const isSelfSellerRole = ['caissier', 'super-admin', 'direction-generale'].includes(
    currentUser?.role?.name ?? ''
  );

  const [clientId, setClientId] = useState('');
  const [learnerMode, setLearnerMode] = useState<LearnerMode>('existing');
  const [newLearner, setNewLearner] = useState<NewLearnerFormState>(emptyNewLearnerForm);
  const [sellerId, setSellerId] = useState('');
  const [sellerIsTrainer, setSellerIsTrainer] = useState(false);
  const [myCommercial, setMyCommercial] = useState<Commercial | null>(null);
  const [paymentType, setPaymentType] = useState<'' | PaymentMethod>('cash');
  const [payerPhone, setPayerPhone] = useState('');
  const [advance, setAdvance] = useState('');
  const [discount, setDiscount] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [comment, setComment] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([newLine()]);
  const [catalogue, setCatalogue] = useState<Service[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Un règlement mobile money sans numéro payeur est inexploitable (traçabilité
  // de la transaction) : le champ apparaît et devient obligatoire pour OM / MoMo.
  const requiresPayerPhone = paymentType === 'om' || paymentType === 'momo';

  const productOptions = useMemo<ProductOption[]>(() => {
    const fromCatalogue: ProductOption[] = catalogue.map((service) => ({
      value: service.id,
      label: service.name,
      price: Number(service.effective_price ?? service.price ?? 0),
      tiers: service.is_seminar ? (service.seminar_tiers ?? []) : [],
      isCourse: false,
    }));
    const fromCourses: ProductOption[] = courses.map((course) => ({
      value: FORMATION_PREFIX + course.id,
      label: course.name,
      price: Number(course.effective_price ?? course.price ?? 0),
      tiers: [],
      isCourse: true,
    }));
    return [...fromCatalogue, ...fromCourses];
  }, [catalogue, courses]);

  const catalogueOptions = useMemo(() => productOptions.filter((o) => !o.isCourse), [productOptions]);
  const courseOptions = useMemo(() => productOptions.filter((o) => o.isCourse), [productOptions]);

  const learnerOptions = useCallback(async (query: string) => {
    const results = await clientsApi.search(query.trim());
    return results.map((c) => ({
      id: c.id,
      label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
      subtitle: [c.email, c.client_number].filter(Boolean).join(' — '),
    }));
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + (Number(line.unit_price) || 0) * (Number(line.quantity) || 0),
      0,
    );
    const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
    const afterDiscount = subtotal - discountValue;
    const vatValue = (Number(vatRate) || 0) / 100;
    const total = afterDiscount * (1 + vatValue);
    const advanceValue = Number(advance) || 0;
    return {
      subtotal,
      discount: discountValue,
      vat: total - afterDiscount,
      total: Math.round(total * 100) / 100,
      advance: advanceValue,
      balance: Math.max(0, Math.round(total * 100) / 100 - advanceValue),
    };
  }, [lines, advance, discount, vatRate]);

  function reset() {
    setClientId('');
    setLearnerMode('existing');
    setNewLearner(emptyNewLearnerForm);
    setSellerId('');
    setSellerIsTrainer(false);
    setPaymentType('cash');
    setPayerPhone('');
    setAdvance('');
    setDiscount('');
    setVatRate('');
    setComment('');
    setProofFile(null);
    setLines([newLine()]);
    setErrors({});
  }

  useEffect(() => {
    if (!isOpen) return;
    reset();
    // La liste déroulante « Produit » propose tout le catalogue visible par
    // l'utilisateur (produits de l'agence + formations) plutôt qu'une saisie
    // texte : le catalogue fait foi sur le libellé et le prix.
    servicesApi
      .list({ per_page: 100, agency_id: agencyId })
      .then((res) => setCatalogue(res.data ?? []))
      .catch(() => setCatalogue([]));
    academyApi
      .courses({ agency_id: agencyId, per_page: 100 })
      .then((res) => setCourses(res.data ?? []))
      .catch(() => setCourses([]));
    if (isCommercial && currentUser?.id) {
      commercialsApi
        .list({ per_page: 100 })
        .then((res) => {
          const mine = (res.data ?? []).find((c) => c.user_id === currentUser.id) ?? null;
          setMyCommercial(mine);
          if (mine) {
            setSellerId(mine.id);
            setSellerIsTrainer(false);
          }
        })
        .catch(() => setMyCommercial(null));
    } else if (currentUser?.role?.name === 'caissier' && currentUser?.id) {
      // Le caissier a un profil employé (Commercial kind=employe) : on le rattache
      // via commercial_id, comme un commercial, pour que ses ventes remontent dans
      // ses stats (CA, nombre de ventes, points).
      employeesApi
        .list({ per_page: 100, include_trainers: true })
        .then((res) => {
          const mine = (res.data ?? []).find((c) => c.user_id === currentUser.id) ?? null;
          if (mine) {
            setMyCommercial(mine);
            setSellerId(mine.id);
            setSellerIsTrainer(false);
          } else {
            setMyCommercial(null);
            setSellerId(currentUser.id);
            setSellerIsTrainer(true);
          }
        })
        .catch(() => {
          setMyCommercial(null);
          setSellerId(currentUser.id);
          setSellerIsTrainer(true);
        });
    } else {
      setMyCommercial(null);
      if (isSelfSellerRole && currentUser?.id) {
        setSellerId(currentUser.id);
        setSellerIsTrainer(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    reset();
    onClose();
  }

  function updateLine(key: string, patch: Partial<InvoiceLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function handleProductSelect(key: string, value: string) {
    if (!value) {
      updateLine(key, { service_id: '', kind: '', label: '', unit_price: '', pass_tier: '' });
      return;
    }
    const option = productOptions.find((o) => o.value === value);
    if (!option) return;
    const alreadyUsed = lines.some((l) => l.key !== key && l.service_id === value);
    if (alreadyUsed) {
      showToast(t('invoices.duplicateService'), 'error');
      return;
    }
    const tiers = option.tiers;
    updateLine(key, {
      service_id: option.value,
      kind: option.isCourse ? 'formation' : 'service',
      label: option.label,
      unit_price: String(tiers[0]?.price ?? option.price),
      pass_tier: tiers[0]?.tier ?? '',
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validLines = lines.filter(
      (l) => l.label.trim() || l.service_id || Number(l.unit_price) > 0,
    );
    if (validLines.length === 0) {
      setErrors({ items: t('invoices.noItems') });
      return;
    }
    if (requiresPayerPhone && !payerPhone.trim()) {
      setErrors({ payer_phone: t('invoices.payerPhoneRequired') });
      return;
    }
    if (Number(advance) > totals.total) {
      setErrors({ advance: t('invoices.advanceExceedsTotal') });
      return;
    }
    if (isCommercial && !proofFile) {
      setErrors({ proof_file: t('invoices.proofRequiredForSale') });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      let buyerId = learnerMode === 'existing' ? clientId : '';
      if (learnerMode === 'new') {
        if (!newLearner.first_name.trim() || !newLearner.last_name.trim()) {
          setErrors({ learner_user_id: t('academy.newLearnerRequired') });
          return;
        }
        // L'apprenant saisi est créé comme client : la facture le rattache à un
        // compte réel, ce qui permet de le retrouver dans l'historique.
        const created = await clientsApi.create({
          first_name: newLearner.first_name.trim(),
          last_name: newLearner.last_name.trim(),
          email: newLearner.email.trim(),
          phone: newLearner.phone.trim() || null,
          country: newLearner.country || undefined,
          registered_agency_id: agencyId,
        });
        buyerId = created.id;
      }

      const payload = {
        client_id: buyerId || undefined,
        commercial_id: !sellerIsTrainer && sellerId ? sellerId : undefined,
        seller_user_id: sellerIsTrainer && sellerId ? sellerId : undefined,
        agency_id: agencyId || undefined,
        payment_type: paymentType || undefined,
        payer_phone: requiresPayerPhone ? payerPhone.trim() : undefined,
        comment: comment || undefined,
        advance: Number(advance) || undefined,
        discount: Number(discount) || undefined,
        vat_rate: Number(vatRate) || undefined,
        items: validLines.map((l) => ({
          service_id: l.kind === 'service' ? l.service_id || undefined : undefined,
          label: l.label.trim() || undefined,
          unit_price: Number(l.unit_price) || 0,
          quantity: Number(l.quantity) || 1,
          pass_tier: l.kind === 'service' ? l.pass_tier || undefined : undefined,
        })),
      };
      if (proofFile) {
        await invoicesApi.createWithProof(payload, proofFile);
      } else {
        await invoicesApi.create(payload);
      }
      showToast(t('invoices.created'), 'success');
      handleClose();
    } catch (error) {
      setErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('invoices.newSale')} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {Object.keys(errors).length > 0 && (
          <Alert variant="error">{Object.values(errors).join(' ')}</Alert>
        )}

        <EnrollmentLearnerField
          mode={learnerMode}
          onModeChange={setLearnerMode}
          learnerUserId={clientId}
          onLearnerUserIdChange={setClientId}
          fetchOptions={learnerOptions}
          newLearner={newLearner}
          onNewLearnerChange={setNewLearner}
          error={errors.learner_user_id}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isCommercial || isSelfSellerRole ? (
            <Input
              label={t('invoices.seller')}
              value={
                myCommercial
                  ? myCommercial.full_name || [myCommercial.first_name, myCommercial.last_name].filter(Boolean).join(' ')
                  : currentUser?.name?.trim() ||
                    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
                    currentUser?.email ||
                    ''
              }
              disabled
            />
          ) : (
            <Autocomplete
              label={t('invoices.seller')}
              placeholder={t('invoices.headerCommercialPlaceholder')}
              value={sellerId}
              onChange={(id) => {
                if (!id) {
                  setSellerId('');
                  setSellerIsTrainer(false);
                }
              }}
              onPick={(option) => {
                if (option.isTrainer) {
                  setSellerIsTrainer(true);
                  setSellerId(option.userId ?? option.id);
                } else {
                  setSellerIsTrainer(false);
                  setSellerId(option.id);
                }
              }}
              fetchOptions={async (query) => {
                const [coms, emps] = await Promise.all([
                  commercialsApi.search(query.trim()).catch(() => []),
                  employeesApi.search(query.trim()).catch(() => []),
                ]);
                const seen = new Set<string>();
                const results: AutocompleteOption[] = [];
                for (const c of [...coms, ...emps]) {
                  if (seen.has(c.id)) continue;
                  seen.add(c.id);
                  if (c.is_trainer && c.user_id) {
                    results.push({
                      id: c.id,
                      userId: c.user_id,
                      isTrainer: true,
                      label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                      subtitle: c.email ?? '',
                    });
                  } else {
                    results.push({
                      id: c.id,
                      label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                      subtitle: c.email ?? '',
                    });
                  }
                }
                return results;
              }}
            />
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{t('invoices.items')}</h3>
          <div className="flex flex-col gap-3">
            {lines.map((line, index) => {
              const tiers = productOptions.find((o) => o.value === line.service_id)?.tiers ?? [];
              const hasTiers = tiers.length > 0;
              return (
                <div key={line.key} className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Select
                      label={index === 0 ? t('invoices.itemProduct') : undefined}
                      value={line.service_id}
                      onChange={(e) => handleProductSelect(line.key, e.target.value)}
                      error={index === 0 ? errors.items : undefined}
                    >
                      <option value="">{t('invoices.itemProductPlaceholder')}</option>
                      {catalogueOptions.length > 0 && (
                        <optgroup label={t('invoices.catalogGroup')}>
                          {catalogueOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {`${o.label} — ${formatCurrency(o.price, currency)}`}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {courseOptions.length > 0 && (
                        <optgroup label={t('invoices.formationsGroup')}>
                          {courseOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {`${o.label} — ${formatCurrency(o.price, currency)}`}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  </div>
                  {hasTiers && (
                    <div className="w-full sm:w-40">
                      <Select
                        label={index === 0 ? t('invoices.passTier') : undefined}
                        value={line.pass_tier}
                        onChange={(e) => {
                          const tier = tiers.find((t) => t.tier === e.target.value);
                          updateLine(line.key, {
                            pass_tier: e.target.value,
                            unit_price: tier ? String(tier.price) : line.unit_price,
                          });
                        }}
                      >
                        {tiers.map((t) => (
                          <option key={t.tier} value={t.tier}>
                            {t.label} — {formatCurrency(Number(t.price), currency)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <div className="w-full sm:w-40">
                    <Input
                      label={index === 0 ? t('invoices.itemLabel') : undefined}
                      value={line.label}
                      onChange={(e) => updateLine(line.key, { label: e.target.value })}
                    />
                  </div>
                  <div className="w-full sm:w-20">
                    <Input
                      label={index === 0 ? t('invoices.itemQuantity') : undefined}
                      type="number"
                      min={1}
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <Input
                      label={index === 0 ? t('invoices.itemUnitPrice') : undefined}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span className="hidden text-sm font-semibold text-gray-800 dark:text-gray-100 sm:block">
                      {formatCurrency((Number(line.unit_price) || 0) * (Number(line.quantity) || 0), currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title={t('invoices.removeLine')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="mt-3"
          >
            <Plus className="h-4 w-4" />
            {t('invoices.addLine')}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('invoices.headerPaymentType')}
            </label>
            <Select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as '' | PaymentMethod)}
            >
              <option value="cash">{t('invoices.paymentCash')}</option>
              <option value="om">{t('invoices.paymentOm')}</option>
              <option value="momo">{t('invoices.paymentMomo')}</option>
            </Select>
          </div>
          {requiresPayerPhone && (
            <Input
              label={`${t('invoices.payerPhone')} *`}
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              error={errors.payer_phone}
              hint={t('invoices.payerPhoneHint')}
              placeholder="+237 6XX XXX XXX"
            />
          )}
          <Input
            label={t('invoices.advance')}
            type="number"
            min={0}
            step="0.01"
            value={advance}
            onChange={(e) => setAdvance(e.target.value)}
            error={errors.advance}
            hint={t('invoices.advanceHint')}
          />
          <Input
            label={t('invoices.discount')}
            type="number"
            min={0}
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            error={errors.discount}
            hint={t('invoices.discountHint')}
          />
          <Input
            label={t('invoices.vatRate')}
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            error={errors.vat_rate}
            hint={t('invoices.vatHint')}
          />
        </div>

        {isCommercial && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('invoices.paymentProof')} <span className="text-error-500">*</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-gray-400"
            />
            {errors.proof_file && <p className="mt-1 text-xs text-error-500">{errors.proof_file}</p>}
            <p className="mt-1 text-xs text-gray-400">{t('invoices.paymentProofHint')}</p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('invoices.headerComment')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('invoices.headerCommentPlaceholder')}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.totalAfterDiscount')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.subtotal, currency)}
              </span>
            </div>
            {totals.discount > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">- {t('invoices.discount')}</span>
                <span className="text-lg font-semibold text-error-500">
                  - {formatCurrency(totals.discount, currency)}
                </span>
              </div>
            )}
            {totals.vat > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('invoices.vatAmount')}</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  + {formatCurrency(totals.vat, currency)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.totalAmount')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.total, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.balanceDue')}</span>
              <span className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                {formatCurrency(totals.balance, currency)}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={isCommercial && !proofFile}
              title={isCommercial && !proofFile ? t('invoices.proofRequiredForSale') : undefined}
            >
              {t('invoices.createSubmit')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
