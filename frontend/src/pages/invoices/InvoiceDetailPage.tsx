import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, XCircle, Wallet, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InvoicePrint } from '@/components/invoices/InvoicePrint';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import type { Invoice, PaymentMethod } from '@/types/invoice';

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat(currentLocale()).format(n)} FCFA`;
}

export default function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(false);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payAdvance, setPayAdvance] = useState(false);
  const [payComment, setPayComment] = useState('');
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [editClientId, setEditClientId] = useState('');
  const [editCommercialId, setEditCommercialId] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<'' | PaymentMethod>('');
  const [editComment, setEditComment] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const canCollect = ['super-admin', 'direction-generale', 'responsable-agence', 'caissier', 'comptable'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchInvoice = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const inv = await invoicesApi.get(id);
      setInvoice(inv);
      setEditClientId(inv.client_id ?? '');
      setEditCommercialId(inv.commercial_id ?? '');
      setEditPaymentType(inv.payment_type ?? '');
      setEditComment(inv.comment ?? '');
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('invoices.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  function openPay() {
    setPayAmount('');
    setPayAdvance(false);
    setPayComment('');
    setPayErrors({});
    setPayOpen(true);
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    setPaySubmitting(true);
    setPayErrors({});
    try {
      await invoicesApi.pay(invoice.id, {
        amount: Number(payAmount),
        payment_method: payMethod,
        is_advance: payAdvance,
        comment: payComment || undefined,
      });
      showToast(t('invoices.paid'), 'success');
      setPayOpen(false);
      fetchInvoice();
    } catch (error) {
      setPayErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.payFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleCancel() {
    if (!invoice) return;
    setCancelSubmitting(true);
    try {
      await invoicesApi.cancel(invoice.id);
      showToast(t('invoices.cancelled'), 'success');
      setCancelTarget(false);
      fetchInvoice();
    } catch (error) {
      showToast(extractErrorMessage(error, t('invoices.cancelFailed')), 'error');
    } finally {
      setCancelSubmitting(false);
    }
  }

  function openEdit() {
    setEditErrors({});
    setEditOpen(true);
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    setEditSubmitting(true);
    setEditErrors({});
    try {
      await invoicesApi.update(invoice.id, {
        client_id: editClientId || undefined,
        commercial_id: editCommercialId || undefined,
        payment_type: editPaymentType || undefined,
        comment: editComment || undefined,
      });
      showToast(t('invoices.updated'), 'success');
      setEditOpen(false);
      fetchInvoice();
    } catch (error) {
      setEditErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setEditSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.title')}
        </Link>
        <p className="text-sm text-error-500">{loadError ?? t('invoices.loadFailed')}</p>
      </div>
    );
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('invoices.detailTitle', { number: invoice.number })}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setPrintOpen(true)}>
              <Printer className="h-4 w-4" />
              {t('invoices.print')}
            </Button>
            {!invoice.is_cancelled && !invoice.payments?.some((p) => !p.is_advance) && canCollect && (
              <Button variant="outline" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            )}
            {!invoice.is_cancelled && invoice.status !== 'paid' && canCollect && (
              <Button onClick={openPay}>
                <Wallet className="h-4 w-4" />
                {t('invoices.pay')}
              </Button>
            )}
            {!invoice.is_cancelled && (
              <Button variant="danger" onClick={() => setCancelTarget(true)}>
                <XCircle className="h-4 w-4" />
                {t('invoices.cancelInvoice')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.totalAmount')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(invoice.total_amount)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.paid')}</p>
          <p className="mt-1 text-2xl font-semibold text-success-500">
            {formatCurrency(invoice.amount_paid)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.balanceDue')}</p>
          <p className="mt-1 text-2xl font-semibold text-error-500">
            {formatCurrency(invoice.balance_due)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.items')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('invoices.itemLabel')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.unitPrice')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.quantity')}</th>
                  <th className="py-2 text-right font-medium">{t('invoices.lineTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(invoice.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">{item.label}</td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoice.comment && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {t('invoices.headerComment')} : {invoice.comment}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.paymentHistory')}
          </h2>
          {(invoice.payments ?? []).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.noPayments')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{t('invoices.paymentAmount')}</th>
                    <th className="py-2 pr-3 font-medium">{t('invoices.paymentMethod')}</th>
                    <th className="py-2 pr-3 font-medium">{t('invoices.paymentDate')}</th>
                    <th className="py-2 font-medium">{t('invoices.paymentIsAdvance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(invoice.payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                        {p.payment_method === 'cash'
                          ? t('invoices.paymentCash')
                          : t('invoices.paymentMobile')}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                        {new Date(p.paid_at).toLocaleDateString(currentLocale())}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">
                        {p.is_advance ? t('common.yes') : t('common.no')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={t('invoices.printTitle')}
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <InvoicePrint invoice={invoice} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t('invoices.print')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        title={t('invoices.payTitle')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePay} className="flex flex-col gap-4">
          {Object.keys(payErrors).length > 0 && (
            <Alert variant="error">{Object.values(payErrors).join(' ')}</Alert>
          )}
          <Input
            label={t('invoices.payAmount')}
            type="number"
            min={0.01}
            step="0.01"
            required
            max={invoice.balance_due}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            error={payErrors.amount}
            hint={`${t('invoices.balanceDueShort')} : ${formatCurrency(invoice.balance_due)}`}
          />
          <Select
            label={t('invoices.payMethod')}
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">{t('invoices.paymentCash')}</option>
            <option value="mobile">{t('invoices.paymentMobile')}</option>
          </Select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={payAdvance}
              onChange={(e) => setPayAdvance(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30"
            />
            {t('invoices.payAdvance')}
          </label>
          <Input
            label={t('invoices.payComment')}
            value={payComment}
            onChange={(e) => setPayComment(e.target.value)}
            error={payErrors.comment}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={paySubmitting} className="flex-1">
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('invoices.editTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEdit} className="flex flex-col gap-4">
          {Object.keys(editErrors).length > 0 && (
            <Alert variant="error">{Object.values(editErrors).join(' ')}</Alert>
          )}
          <Autocomplete
            label={t('invoices.headerClient')}
            placeholder={t('invoices.headerClientPlaceholder')}
            value={editClientId}
            onChange={setEditClientId}
            fetchOptions={async (query) => {
              const res = await clientsApi.search(query.trim());
              return res.map((c) => ({
                id: c.id,
                label: c.name,
                subtitle: c.email,
              }));
            }}
            error={editErrors.client_id}
          />
          <Autocomplete
            label={t('invoices.headerCommercial')}
            placeholder={t('invoices.headerCommercialPlaceholder')}
            value={editCommercialId}
            onChange={setEditCommercialId}
            fetchOptions={async (query) => {
              const res = await commercialsApi.search(query.trim());
              return res.map((c) => ({
                id: c.id,
                label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                subtitle: c.email ?? '',
              }));
            }}
          />
          <Select
            label={t('invoices.headerPaymentType')}
            value={editPaymentType}
            onChange={(e) => setEditPaymentType(e.target.value as '' | PaymentMethod)}
          >
            <option value="">—</option>
            <option value="cash">{t('invoices.paymentCash')}</option>
            <option value="mobile">{t('invoices.paymentMobile')}</option>
          </Select>
          <Input
            label={t('invoices.headerComment')}
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            error={editErrors.comment}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={editSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={cancelTarget}
        title={t('invoices.cancelTitle')}
        message={t('invoices.cancelMessage', { number: invoice.number })}
        confirmLabel={t('invoices.cancelInvoice')}
        variant="danger"
        isLoading={cancelSubmitting}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(false)}
      />
    </div>
  );
}
