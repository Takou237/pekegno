import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
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
import type { ServiceSearchItem, SeminarTier } from '@/types/service';

export default function QuickSalePage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Service
  const [serviceId, setServiceId] = useState('');
  const [serviceLabel, setServiceLabel] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [passTier, setPassTier] = useState('');
  const [seminarTiers, setSeminarTiers] = useState<SeminarTier[]>([]);

  // Payment
  const [paymentType, setPaymentType] = useState<'' | PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');

  // Optional
  const [clientId, setClientId] = useState('');
  const [comment, setComment] = useState('');

  // Form state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const serviceResultsRef = useRef<ServiceSearchItem[]>([]);

  const total = useMemo(
    () => (Number(unitPrice) || 0) * (Number(quantity) || 0),
    [unitPrice, quantity],
  );

  const change = useMemo(
    () => Math.max(0, (Number(amountReceived) || 0) - total),
    [amountReceived, total],
  );

  function handleServiceSelect(id: string) {
    const service = serviceResultsRef.current.find((s) => s.id === id);
    if (!service) return;
    setServiceId(service.id);
    setServiceLabel(service.name);
    if (service.is_seminar && service.seminar_tiers && service.seminar_tiers.length > 0) {
      setSeminarTiers(service.seminar_tiers);
      setPassTier(service.seminar_tiers[0].tier);
      setUnitPrice(String(service.seminar_tiers[0].price));
    } else {
      setSeminarTiers([]);
      setPassTier('');
      setUnitPrice(String(service.effective_price ?? service.price ?? ''));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!serviceId && !serviceLabel.trim()) {
      setErrors({ service_id: t('invoices.quickSelectService') });
      return;
    }
    if (!paymentType) {
      setErrors({ payment_type: t('invoices.quickSelectPaymentType') });
      return;
    }
    if (Number(amountReceived) <= 0 && total > 0) {
      setErrors({ amount_received: t('invoices.quickReceiveAmountRequired') });
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const freeClientName = clientId.startsWith(FREE_TEXT_PREFIX) ? clientId.slice(FREE_TEXT_PREFIX.length) : '';
      const invoice = await invoicesApi.create({
        client_id: freeClientName ? undefined : clientId || undefined,
        client_name: freeClientName || undefined,
        payment_type: paymentType || undefined,
        comment: comment || undefined,
        items: [
          {
            service_id: serviceId || undefined,
            label: serviceLabel.trim() || undefined,
            unit_price: Number(unitPrice) || 0,
            quantity: Number(quantity) || 1,
            pass_tier: passTier || undefined,
          },
        ],
      });

      // Immediately record the payment if amount received > 0
      if (Number(amountReceived) > 0) {
        await invoicesApi.pay(invoice.id, {
          amount: Number(amountReceived),
          payment_method: paymentType as PaymentMethod,
        });
      }

      showToast(t('invoices.quickSuccess'), 'success');
      navigate(`/invoices/${invoice.id}`);
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
          to="/invoices"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.backToList')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('invoices.quickTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('invoices.quickSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {Object.keys(errors).length > 0 && (
          <Alert variant="error">{Object.values(errors).join(' ')}</Alert>
        )}

        {/* Service & pricing */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.items')}
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Autocomplete
                label={t('invoices.itemService')}
                placeholder={t('invoices.itemServicePlaceholder')}
                value={serviceId}
                onChange={handleServiceSelect}
                fetchOptions={async (query) => {
                  const res = await servicesApi.search(query.trim());
                  serviceResultsRef.current = res;
                  return res.map((s) => ({
                    id: s.id,
                    label: s.name,
                    subtitle: `${formatCurrency(Number(s.effective_price ?? s.price))}${
                      s.has_promotion ? ' · promo' : ''
                    }${s.category ? ` · ${s.category}` : ''}`,
                  }));
                }}
                error={errors.service_id}
              />
            </div>
            {seminarTiers.length > 0 && (
              <div className="w-full sm:w-40">
                <Select
                  label={t('invoices.passTier')}
                  value={passTier}
                  onChange={(e) => {
                    const tier = seminarTiers.find((t) => t.tier === e.target.value);
                    setPassTier(e.target.value);
                    if (tier) setUnitPrice(String(tier.price));
                  }}
                >
                  {seminarTiers.map((t) => (
                    <option key={t.tier} value={t.tier}>{t.label} — {formatCurrency(Number(t.price))}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="w-full sm:w-36">
              <Input
                label={t('invoices.itemUnitPrice')}
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                error={errors['items.0.unit_price']}
              />
            </div>
            <div className="w-full sm:w-24">
              <Input
                label={t('invoices.itemQuantity')}
                type="number"
                min={1}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                error={errors['items.0.quantity']}
              />
            </div>
            <div className="flex items-center">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.pay')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label={t('invoices.headerPaymentType')}
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as '' | PaymentMethod)}
              error={errors.payment_type}
            >
              <option value="cash">{t('invoices.paymentCash')}</option>
              <option value="mobile">{t('invoices.paymentMobile')}</option>
            </Select>
            <Input
              label={t('invoices.quickReceiveAmount')}
              type="number"
              min={0}
              step="0.01"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              error={errors.amount_received}
              hint={t('invoices.quickReceiveAmountHint')}
            />
            <div className="flex flex-col justify-end gap-1">
              {Number(amountReceived) > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('invoices.balanceDue')}: {formatCurrency(change)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Optional fields */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.quickOptional')}
          </h2>
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
        </div>

        {/* Summary & submit */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {t('invoices.totalAmount')}
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(total)}
              </span>
            </div>
            <Button type="submit" isLoading={submitting}>
              {t('invoices.quickSubmit')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
