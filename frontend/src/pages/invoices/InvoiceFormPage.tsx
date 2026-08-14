import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { agenciesApi } from '@/api/agencies.api';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Autocomplete, FREE_TEXT_PREFIX } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import type { PaymentMethod } from '@/types/invoice';
import type { ServiceSearchItem } from '@/types/service';

interface InvoiceLineDraft {
  key: string;
  service_id: string;
  label: string;
  unit_price: string;
  quantity: string;
}

let lineCounter = 0;
function newLine(): InvoiceLineDraft {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, service_id: '', label: '', unit_price: '', quantity: '1' };
}

export default function InvoiceFormPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { agencyId: routeAgencyId } = useParams<{ agencyId?: string }>();
  const [searchParams] = useSearchParams();

  const presetAgencyId = routeAgencyId ?? searchParams.get('agency_id') ?? '';
  const [agencyLocked] = useState(Boolean(presetAgencyId));
  const [lockedAgencyName, setLockedAgencyName] = useState('');

  const [clientId, setClientId] = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [agencyId, setAgencyId] = useState(presetAgencyId);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<'' | PaymentMethod>('');
  const [advance, setAdvance] = useState('');
  const [discount, setDiscount] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState<InvoiceLineDraft[]>([newLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const serviceResultsRef = useRef<Record<string, ServiceSearchItem[]>>({});

  useEffect(() => {
    if (!agencyLocked || !presetAgencyId) return;
    let active = true;
    agenciesApi
      .get(presetAgencyId)
      .then((a) => {
        if (active) setLockedAgencyName(a.name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [agencyLocked, presetAgencyId]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + (Number(line.unit_price) || 0) * (Number(line.quantity) || 0),
      0
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

  function updateLine(key: string, patch: Partial<InvoiceLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function handleServiceSelect(key: string, serviceId: string) {
    const results = serviceResultsRef.current[key] ?? [];
    const service = results.find((s) => s.id === serviceId);
    if (!service) return;
    const alreadyUsed = lines.some((l) => l.key !== key && l.service_id === serviceId);
    if (alreadyUsed) {
      showToast(t('invoices.duplicateService'), 'error');
      return;
    }
    updateLine(key, {
      service_id: service.id,
      label: service.name,
      unit_price: String(service.effective_price ?? service.price ?? ''),
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validLines = lines.filter(
      (l) => l.label.trim() || l.service_id || Number(l.unit_price) > 0
    );
    if (validLines.length === 0) {
      setErrors({ items: t('invoices.noItems') });
      return;
    }
    if (!clientId) {
      setErrors({ client_id: t('invoices.colClient') });
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
        commercial_id: commercialId || undefined,
        agency_id: agencyId || undefined,
        invoice_date: invoiceDate,
        payment_type: paymentType || undefined,
        comment: comment || undefined,
        advance: Number(advance) || undefined,
        discount: Number(discount) || undefined,
        vat_rate: Number(vatRate) || undefined,
        items: validLines.map((l) => ({
          service_id: l.service_id || undefined,
          label: l.label.trim() || undefined,
          unit_price: Number(l.unit_price) || 0,
          quantity: Number(l.quantity) || 1,
        })),
      });
      showToast(t('invoices.created'), 'success');
      navigate(agencyLocked ? `/agencies/${presetAgencyId}/invoices` : '/invoices');
    } catch (error) {
      setErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={agencyLocked ? `/agencies/${presetAgencyId}/invoices` : '/invoices'}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.backToList')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.createTitle')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {Object.keys(errors).length > 0 && (
          <Alert variant="error">{Object.values(errors).join(' ')}</Alert>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
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
            <Autocomplete
              label={t('invoices.headerCommercial')}
              placeholder={t('invoices.headerCommercialPlaceholder')}
              value={commercialId}
              onChange={setCommercialId}
              fetchOptions={async (query) => {
                const res = await commercialsApi.search(query.trim());
                return res.map((c) => ({
                  id: c.id,
                  label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                  subtitle: c.email ?? '',
                }));
              }}
            />
            {agencyLocked ? (
              <Input
                label={t('invoices.headerAgency')}
                value={lockedAgencyName}
                disabled
                hint={t('invoices.agencyLockedHint')}
              />
            ) : (
              <Autocomplete
                label={t('invoices.headerAgency')}
                placeholder={t('commercials.agencyPlaceholder')}
                value={agencyId}
                onChange={setAgencyId}
                fetchOptions={async (query) => {
                  const res = await agenciesApi.list({ search: query.trim() || undefined, per_page: 20 });
                  return res.data.map((a) => ({
                    id: a.id,
                    label: a.name,
                    subtitle: [a.code, a.city].filter(Boolean).join(' — '),
                  }));
                }}
                error={errors.agency_id}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('invoices.headerDate')}
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                error={errors.invoice_date}
              />
              <Select
                label={t('invoices.headerPaymentType')}
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as '' | PaymentMethod)}
              >
                <option value="">—</option>
                <option value="cash">{t('invoices.paymentCash')}</option>
                <option value="mobile">{t('invoices.paymentMobile')}</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.items')}
          </h2>
          <div className="flex flex-col gap-4">
            {lines.map((line, index) => (
              <div key={line.key} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Autocomplete
                    label={index === 0 ? t('invoices.itemService') : undefined}
                    placeholder={t('invoices.itemServicePlaceholder')}
                    value={line.service_id}
                    onChange={(serviceId) => handleServiceSelect(line.key, serviceId)}
                      fetchOptions={async (query) => {
                        const res = await servicesApi.search(query.trim());
                        serviceResultsRef.current[line.key] = res;
                        return res.map((s) => ({
                          id: s.id,
                          label: s.name,
                          subtitle: `${formatCurrency(Number(s.effective_price ?? s.price))}${
                            s.has_promotion ? ' · promo' : ''
                          }${s.category ? ` · ${s.category}` : ''}`,
                        }));
                      }}
                  />
                </div>
                <div className="w-full sm:w-52">
                  <Input
                    label={index === 0 ? t('invoices.itemLabel') : ''}
                    value={line.label}
                    onChange={(e) => updateLine(line.key, { label: e.target.value })}
                    error={errors[`items.${index}.label`]}
                  />
                </div>
                <div className="w-full sm:w-24">
                  <Input
                    label={index === 0 ? t('invoices.itemQuantity') : ''}
                    type="number"
                    min={1}
                    step="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    error={errors[`items.${index}.quantity`]}
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Input
                    label={index === 0 ? t('invoices.itemUnitPrice') : ''}
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                    error={errors[`items.${index}.unit_price`]}
                  />
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="hidden text-sm font-semibold text-gray-800 dark:text-gray-100 sm:block">
                    {formatCurrency(
                      (Number(line.unit_price) || 0) * (Number(line.quantity) || 0)
                    )}
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
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="mt-4"
          >
            <Plus className="h-4 w-4" />
            {t('invoices.addLine')}
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
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
            <Button type="submit" isLoading={submitting}>
              {t('invoices.createSubmit')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
