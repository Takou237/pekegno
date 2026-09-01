import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, ExternalLink, Upload, X } from 'lucide-react';
import { ordersApi } from '@/api/orders.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import type { Order, OrderStatus } from '@/types/order';
import type { PaymentMethod } from '@/types/invoice';

const STATUS_VARIANTS: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'error'> = {
  draft: 'neutral',
  confirmed: 'warning',
  pending_validation: 'warning',
  completed: 'success',
  cancelled: 'error',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errors, setErrors] = useState<string>('');

  // Soumission avec preuve (si pas encore soumise)
  const [showSubmit, setShowSubmit] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [proofPath, setProofPath] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  // Validation / refus
  const [showValidate, setShowValidate] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [declineNote, setDeclineNote] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await ordersApi.get(id);
      setOrder(data);
    } catch (error) {
      showToast(extractErrorMessage(error, t('orders.loadFailed')), 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleProofFile(file: File | null) {
    if (!file) {
      return;
    }
    setUploadingProof(true);
    setErrors('');
    try {
      const res = await uploadsApi.uploadProof(file);
      setProofUrl(res.url);
      setProofPath(res.path);
    } catch (error) {
      setErrors(extractErrorMessage(error, t('orders.proofUploadFailed')));
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleSubmit() {
    if (!order) return;
    setLoadingAction(true);
    setErrors('');
    try {
      const updated = await ordersApi.submit(order.id, { proof_path: proofPath, proof_url: proofUrl });
      setOrder(updated);
      setShowSubmit(false);
      showToast(t('orders.submittedSuccess'), 'success');
    } catch (error) {
      setErrors(extractErrorMessage(error, t('orders.actionFailed')));
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleValidate() {
    if (!order) return;
    setLoadingAction(true);
    setErrors('');
    try {
      await ordersApi.validateSubmission(order.id, { payment_method: paymentMethod });
      showToast(t('orders.validatedSuccess'), 'success');
      setShowValidate(false);
      load();
    } catch (error) {
      setErrors(extractErrorMessage(error, t('orders.actionFailed')));
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDecline() {
    if (!order) return;
    setLoadingAction(true);
    setErrors('');
    try {
      const updated = await ordersApi.decline(order.id, { note: declineNote || undefined });
      setOrder(updated);
      setShowDecline(false);
      showToast(t('orders.declinedSuccess'), 'success');
    } catch (error) {
      setErrors(extractErrorMessage(error, t('orders.actionFailed')));
    } finally {
      setLoadingAction(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="text-gray-500">{t('orders.notFound')}</p>
        <Link to="/orders" className="text-sm font-medium text-brand-600 hover:underline">
          {t('orders.backToList')}
        </Link>
      </div>
    );
  }

  const clientName = order.client
    ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ') || order.client.email
    : '—';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('orders.backToList')}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{order.number}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {order.order_date} · {clientName}
            </p>
          </div>
          <Badge variant={STATUS_VARIANTS[order.status] ?? 'neutral'}>
            {t(`orders.status.${order.status}`, { defaultValue: order.status })}
          </Badge>
        </div>
      </div>

      {errors && <Alert variant="error">{errors}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{t('orders.items')}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {(order.lines ?? []).map((line) => (
              <li key={line.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{line.label}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(Number(line.unit_price))} × {line.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(Number(line.line_total))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-1 border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('orders.subtotal')}</span>
              <span className="text-gray-800 dark:text-gray-200">{formatCurrency(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('orders.discount')}</span>
              <span className="text-gray-800 dark:text-gray-200">− {formatCurrency(Number(order.discount))}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-100 pt-3 text-base font-semibold dark:border-gray-800">
              <span className="text-gray-900 dark:text-white">{t('orders.total')}</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(Number(order.total_amount))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{t('orders.proof')}</h2>
          {order.proof_url ? (
            <a
              href={order.proof_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              {t('orders.viewProof')}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <p className="text-sm text-gray-400">{t('orders.noProof')}</p>
          )}
          {order.validation_note && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {t('orders.validationNote')}
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{order.validation_note}</p>
            </div>
          )}
          {order.validatedBy && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('orders.validatedBy')}</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {[order.validatedBy.first_name, order.validatedBy.last_name].filter(Boolean).join(' ') || order.validatedBy.email}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions contextuelles */}
      <div className="flex flex-wrap gap-2">
        {(order.status === 'draft' || order.status === 'confirmed') && (
          <Button onClick={() => setShowSubmit(true)} disabled={uploadingProof}>
            <Upload className="h-4 w-4" />
            {t('orders.submitForValidation')}
          </Button>
        )}
        {order.status === 'pending_validation' && (
          <>
            <Button variant="danger" onClick={() => setShowDecline(true)}>
              <X className="h-4 w-4" />
              {t('orders.decline')}
            </Button>
            <Button onClick={() => setShowValidate(true)}>
              <Check className="h-4 w-4" />
              {t('orders.validate')}
            </Button>
          </>
        )}
      </div>

      {/* Modal soumission */}
      <Modal isOpen={showSubmit} onClose={() => setShowSubmit(false)} title={t('orders.submitModalTitle')}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('orders.proofLabel')}
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300">
              <Upload className="h-4 w-4" />
              {t('orders.chooseProof')}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => handleProofFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploadingProof && <Spinner />}
            {proofUrl && <p className="mt-1 text-sm text-success-600">{t('orders.proofUploaded')}</p>}
            <p className="mt-1 text-xs text-gray-400">{t('orders.proofHint')}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSubmit(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={handleSubmit} isLoading={loadingAction} disabled={uploadingProof || !proofUrl}>
              {t('orders.confirmSubmit')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal validation */}
      <Modal isOpen={showValidate} onClose={() => setShowValidate(false)} title={t('orders.validateModalTitle')}>
        <div className="flex flex-col gap-4">
          <Select
            label={t('invoices.headerPaymentType')}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">{t('invoices.paymentCash')}</option>
            <option value="om">{t('invoices.paymentOm')}</option>
            <option value="momo">{t('invoices.paymentMomo')}</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowValidate(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={handleValidate} isLoading={loadingAction}>
              <Check className="h-4 w-4" />
              {t('orders.confirmValidation')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal refus */}
      <Modal isOpen={showDecline} onClose={() => setShowDecline(false)} title={t('orders.declineModalTitle')}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('orders.declineReason')}
            </label>
            <textarea
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDecline(false)}>
              {t('common.close')}
            </Button>
            <Button variant="danger" onClick={handleDecline} isLoading={loadingAction}>
              <X className="h-4 w-4" />
              {t('orders.confirmDecline')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
