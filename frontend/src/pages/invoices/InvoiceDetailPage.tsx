import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, XCircle, Wallet, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { employeesApi } from '@/api/employees.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { formatRelativeDate } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Autocomplete, FREE_TEXT_PREFIX } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InvoicePrint } from '@/components/invoices/InvoicePrint';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import type { Invoice, PaymentMethod } from '@/types/invoice';

export default function InvoiceDetailPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { id: routeId = '', invoiceId = '' } = useParams();
  const id = invoiceId || routeId;
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const backToList = fixedAgencyId ? `/agencies/${fixedAgencyId}/invoices` : '/invoices';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(false);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payComment, setPayComment] = useState('');
  const [payPaidAt, setPayPaidAt] = useState('');
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
      setEditClientId(inv.client_name ? FREE_TEXT_PREFIX + inv.client_name : inv.client_id ?? '');
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
    setPayComment('');
    setPayPaidAt(new Date().toISOString().slice(0, 10));
    setPayErrors({});
    setPayOpen(true);
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayErrors({ amount: t('invoices.payAmountError') });
      return;
    }
    if (amount > invoice.balance_due) {
      setPayErrors({ amount: t('invoices.payOverpayment') });
      return;
    }
    setPaySubmitting(true);
    setPayErrors({});
    try {
      await invoicesApi.pay(invoice.id, {
        amount,
        payment_method: payMethod,
        paid_at: payPaidAt || undefined,
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
      const freeClientName = editClientId.startsWith(FREE_TEXT_PREFIX) ? editClientId.slice(FREE_TEXT_PREFIX.length) : '';
      await invoicesApi.update(invoice.id, {
        client_id: freeClientName ? undefined : editClientId || undefined,
        client_name: freeClientName || undefined,
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
      <SkeletonDetail />
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to={backToList}
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
          to={backToList}
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
              <Button onClick={openPay} disabled={invoice.payments ? invoice.payments.length >= 3 : false}>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.paidAmount')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(invoice.amount_paid)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.balanceDue')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(invoice.balance_due)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.invoiceDate')}</p>
          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {formatRelativeDate(invoice.invoice_date)}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(invoice.invoice_date).toLocaleString(currentLocale())}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.clientLabel')}</p>
          {invoice.client_label ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {invoice.client_label}
              </p>
              {invoice.client && (
                <>
                  <p className="text-gray-600 dark:text-gray-300">{invoice.client.email}</p>
                  {invoice.client.phone && (
                    <p className="text-gray-600 dark:text-gray-300">{invoice.client.phone}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-400">—</p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.commercialLabel')}</p>
          {invoice.commercial ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {[invoice.commercial.first_name, invoice.commercial.last_name].filter(Boolean).join(' ')}
              </p>
              {invoice.commercial.email && (
                <p className="text-gray-600 dark:text-gray-300">{invoice.commercial.email}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-400">—</p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.seller')}</p>
          {invoice.seller ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {[invoice.seller.first_name, invoice.seller.last_name].filter(Boolean).join(' ') || invoice.seller.email}
              </p>
              {invoice.payment_type && (
                <p className="text-gray-600 dark:text-gray-300">
                  {invoice.payment_type === 'cash'
                    ? t('invoices.paymentCash')
                    : invoice.payment_type === 'om'
                    ? t('invoices.paymentOm')
                    : t('invoices.paymentMomo')}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-400">—</p>
          )}
        </div>
      </div>

      {invoice.payments && invoice.payments.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.paymentHistory')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('invoices.paymentDate')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.paymentMethod')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.treasuryAccount')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.paymentAmount')}</th>
                  <th className="py-2 font-medium">{t('invoices.paymentReceivedBy')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString(currentLocale()) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {p.payment_method === 'cash' ? t('invoices.paymentCash') : p.payment_method === 'om' ? t('invoices.paymentOm') : p.payment_method === 'momo' ? t('invoices.paymentMomo') : t('invoices.paymentMobile')}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {p.treasury_account?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {p.receiver
                        ? [p.receiver.first_name, p.receiver.last_name].filter(Boolean).join(' ') || p.receiver.email
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.quantity')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.unitPrice')}</th>
                  <th className="py-2 text-right font-medium">{t('invoices.lineTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(invoice.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      <span>{item.label}</span>
                      {item.pass_label && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {item.pass_label}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(item.unit_price)}
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
            {t('invoices.totalAmount')}
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t('invoices.totalAfterDiscount')}</span>
              <span>
                {formatCurrency(Number(invoice.total_amount) + Number(invoice.discount) - Number(invoice.vat_amount))}
              </span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>{t('invoices.discountLabel')}</span>
                <span>- {formatCurrency(invoice.discount)}</span>
              </div>
            )}
            {Number(invoice.vat_rate) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>{t('invoices.vatAmount')} ({invoice.vat_rate}%)</span>
                <span>+ {formatCurrency(invoice.vat_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-gray-800 dark:text-gray-100">
              <span>{t('invoices.totalAmount')}</span>
              <span>{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t('invoices.paidAmount')}</span>
              <span>{formatCurrency(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-gray-800 dark:text-gray-100">
              <span>{t('invoices.balanceDue')}</span>
              <span>{formatCurrency(invoice.balance_due)}</span>
            </div>
          </div>
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
            hint={Number(payAmount) > invoice.balance_due && payAmount !== '' ? `⚠ ${t('invoices.payOverpayment')} (${formatCurrency(invoice.balance_due)})` : `${t('invoices.balanceDueShort')} : ${formatCurrency(invoice.balance_due)}`}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('invoices.payMethod')}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">{t('invoices.paymentCash')}</option>
              <option value="om">{t('invoices.paymentOm')}</option>
              <option value="momo">{t('invoices.paymentMomo')}</option>
            </Select>
            <Input
              label={t('invoices.payDate')}
              type="date"
              value={payPaidAt}
              onChange={(e) => setPayPaidAt(e.target.value)}
            />
          </div>
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
            <Button type="submit" isLoading={paySubmitting} className="flex-1" disabled={!payAmount || Number(payAmount) <= 0 || Number(payAmount) > invoice.balance_due}>
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
            freeText
            fetchOptions={async (query) => {
              const res = await clientsApi.search(query.trim());
              return res.map((c) => ({
                id: c.id,
                label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
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
              const [coms, emps] = await Promise.all([
                commercialsApi.search(query.trim()).catch(() => []),
                employeesApi.search(query.trim()).catch(() => []),
              ]);
              const seen = new Set<string>();
              const results: { id: string; label: string; subtitle: string }[] = [];
              for (const c of [...coms, ...emps]) {
                if (seen.has(c.id)) continue;
                seen.add(c.id);
                results.push({
                  id: c.id,
                  label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                  subtitle: c.email ?? '',
                });
              }
              return results;
            }}
          />
          <Select
            label={t('invoices.headerPaymentType')}
            value={editPaymentType}
            onChange={(e) => setEditPaymentType(e.target.value as '' | PaymentMethod)}
          >
            <option value="">—</option>
            <option value="cash">{t('invoices.paymentCash')}</option>
            <option value="om">{t('invoices.paymentOm')}</option>
            <option value="momo">{t('invoices.paymentMomo')}</option>
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
