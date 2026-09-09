import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { Autocomplete, FREE_TEXT_PREFIX, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import type { PaymentMethod } from '@/types/invoice';
import type { ServiceSearchItem } from '@/types/service';
import type { Commercial } from '@/types/commercial';

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

interface QuickSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencyId?: string;
}

export default function QuickSaleModal({ isOpen, onClose, agencyId }: QuickSaleModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isCommercial = currentUser?.role?.name === 'commercial';

  const [clientId, setClientId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [sellerIsTrainer, setSellerIsTrainer] = useState(false);
  const [myCommercial, setMyCommercial] = useState<Commercial | null>(null);
  const [paymentType, setPaymentType] = useState<'' | PaymentMethod>('cash');
  const [advance, setAdvance] = useState('');
  const [discount, setDiscount] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<InvoiceLineDraft[]>([newLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const serviceResultsRef = useRef<Record<string, ServiceSearchItem[]>>({});
  const courseResultsRef = useRef<Record<string, Course | null>>({});

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
    setSellerId('');
    setSellerIsTrainer(false);
    setPaymentType('cash');
    setAdvance('');
    setDiscount('');
    setVatRate('');
    setComment('');
    setLines([newLine()]);
    setErrors({});
  }

  useEffect(() => {
    if (!isOpen) return;
    reset();
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
    } else {
      setMyCommercial(null);
    }
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

  function handleServiceSelect(key: string, lineId: string) {
    if (lineId.startsWith(FORMATION_PREFIX)) {
      const entry = courseResultsRef.current[lineId];
      if (!entry) return;
      const alreadyUsed = lines.some((l) => l.key !== key && l.service_id === lineId);
      if (alreadyUsed) {
        showToast(t('invoices.duplicateService'), 'error');
        return;
      }
      updateLine(key, {
        service_id: lineId,
        kind: 'formation',
        label: entry.name,
        unit_price: String(entry.effective_price ?? entry.price ?? ''),
        pass_tier: '',
      });
      return;
    }
    const results = serviceResultsRef.current[key] ?? [];
    const service = results.find((s) => s.id === lineId);
    if (!service) return;
    const alreadyUsed = lines.some((l) => l.key !== key && l.service_id === lineId);
    if (alreadyUsed) {
      showToast(t('invoices.duplicateService'), 'error');
      return;
    }
    const patches: Partial<InvoiceLineDraft> = {
      service_id: service.id,
      kind: 'service',
      label: service.name,
      unit_price: String(service.effective_price ?? service.price ?? ''),
    };
    if (service.is_seminar && service.seminar_tiers && service.seminar_tiers.length > 0) {
      patches.pass_tier = service.seminar_tiers[0].tier;
      patches.unit_price = String(service.seminar_tiers[0].price);
    } else {
      patches.pass_tier = '';
    }
    updateLine(key, patches);
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
    if (Number(advance) > totals.total) {
      setErrors({ advance: t('invoices.advanceExceedsTotal') });
      return;
    }
    const freeClientName = clientId.startsWith(FREE_TEXT_PREFIX) ? clientId.slice(FREE_TEXT_PREFIX.length) : '';
    setSubmitting(true);
    setErrors({});
    try {
      await invoicesApi.create({
        client_id: freeClientName ? undefined : clientId || undefined,
        client_name: freeClientName || undefined,
        commercial_id: !sellerIsTrainer && sellerId ? sellerId : undefined,
        seller_user_id: sellerIsTrainer && sellerId ? sellerId : undefined,
        agency_id: agencyId || undefined,
        payment_type: paymentType || undefined,
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
      });
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Autocomplete
            label={t('invoices.headerClient')}
            placeholder={t('invoices.headerClientPlaceholder')}
            value={clientId}
            onChange={setClientId}
            freeText
            fetchOptions={async (query) => {
              const res = await clientsApi.search(query.trim());
              return res.map((c) => ({
                id: c.id,
                label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                subtitle: [c.email, c.client_number].filter(Boolean).join(' — '),
              }));
            }}
            error={errors.client_id}
          />
          {isCommercial ? (
            <Input
              label={t('invoices.seller')}
              value={
                myCommercial
                  ? myCommercial.full_name || [myCommercial.first_name, myCommercial.last_name].filter(Boolean).join(' ')
                  : currentUser?.name || ''
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
              const results = serviceResultsRef.current[line.key] ?? [];
              const selectedService =
                line.kind !== 'formation' ? results.find((s) => s.id === line.service_id) : undefined;
              const tiers = selectedService?.seminar_tiers;
              const hasTiers = line.pass_tier !== '' && tiers && tiers.length > 0;
              return (
                <div key={line.key} className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Autocomplete
                      label={index === 0 ? t('invoices.itemService') : undefined}
                      placeholder={t('invoices.itemServicePlaceholder')}
                      value={line.service_id}
                      onChange={(serviceId) => handleServiceSelect(line.key, serviceId)}
                      fetchOptions={async (query) => {
                        const q = query.trim();
                        const [res, courses] = await Promise.all([
                          servicesApi.search(q),
                          academyApi.courses({ search: q || undefined, per_page: 100 }),
                        ]);
                        serviceResultsRef.current[line.key] = res;
                        courseResultsRef.current[line.key] = null;
                        return [
                          ...res.map((s) => ({
                            id: s.id,
                            label: s.name,
                            subtitle: `${formatCurrency(Number(s.effective_price ?? s.price))}${
                              s.has_promotion ? ' · promo' : ''
                            }${s.category ? ` · ${s.category}` : ''}`,
                          })),
                          ...courses.data.map((c) => {
                            courseResultsRef.current[FORMATION_PREFIX + c.id] = c;
                            return {
                              id: FORMATION_PREFIX + c.id,
                              label: c.name,
                              subtitle: `${t('nav.courses')} — ${formatCurrency(
                                Number(c.effective_price ?? c.price ?? 0),
                              )}`,
                            };
                          }),
                        ];
                      }}
                    />
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
                            {t.label} — {formatCurrency(Number(t.price))}
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
                      {formatCurrency((Number(line.unit_price) || 0) * (Number(line.quantity) || 0))}
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
                {formatCurrency(totals.subtotal)}
              </span>
            </div>
            {totals.discount > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">- {t('invoices.discount')}</span>
                <span className="text-lg font-semibold text-error-500">
                  - {formatCurrency(totals.discount)}
                </span>
              </div>
            )}
            {totals.vat > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('invoices.vatAmount')}</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  + {formatCurrency(totals.vat)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.totalAmount')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.total)}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.balanceDue')}</span>
              <span className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                {formatCurrency(totals.balance)}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={submitting}>
              {t('invoices.createSubmit')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
