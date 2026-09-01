import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react';
import { ordersApi } from '@/api/orders.api';
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

export default function OrderValidationPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; total: number; per_page: number }>({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 15,
  });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('pending_validation');
  const [loading, setLoading] = useState(true);

  // Modal de validation
  const [selected, setSelected] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [declineNote, setDeclineNote] = useState('');
  const [mode, setMode] = useState<'validate' | 'decline'>('validate');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string>('');

  const loadOrders = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      try {
        const res = await ordersApi.list({
          page: targetPage,
          status: statusFilter || undefined,
          per_page: 15,
        });
        setOrders(res.data);
        setPagination({
          current_page: res.meta.current_page,
          last_page: res.meta.last_page,
          total: res.meta.total,
          per_page: res.meta.per_page,
        });
      } catch (error) {
        showToast(extractErrorMessage(error, t('orders.loadFailed')), 'error');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, showToast, t],
  );

  useEffect(() => {
    setPage(1);
    loadOrders(1);
  }, [loadOrders]);

  function openValidate(order: Order) {
    setSelected(order);
    setMode('validate');
    setPaymentMethod('cash');
    setDeclineNote('');
    setErrors('');
  }

  function openDecline(order: Order) {
    setSelected(order);
    setMode('decline');
    setDeclineNote('');
    setErrors('');
  }

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    setErrors('');
    try {
      if (mode === 'validate') {
        await ordersApi.validateSubmission(selected.id, {
          payment_method: paymentMethod,
          note: undefined,
        });
        showToast(t('orders.validatedSuccess'), 'success');
      } else {
        await ordersApi.decline(selected.id, { note: declineNote || undefined });
        showToast(t('orders.declinedSuccess'), 'success');
      }
      setSelected(null);
      loadOrders(page);
    } catch (error) {
      setErrors(extractErrorMessage(error, t('orders.actionFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('orders.backToHome')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('orders.validationTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('orders.validationSubtitle')}</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <Select
            label={t('orders.filterStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
            className="sm:max-w-xs"
          >
            <option value="">{t('orders.allStatuses')}</option>
            {(['draft', 'confirmed', 'pending_validation', 'completed', 'cancelled'] as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(`orders.status.${s}`, { defaultValue: s })}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => loadOrders(page)}>
            {t('orders.refresh')}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex justify-center py-12 text-sm text-gray-400">{t('orders.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3">{t('orders.number')}</th>
                  <th className="px-4 py-3">{t('orders.client')}</th>
                  <th className="px-4 py-3">{t('orders.total')}</th>
                  <th className="px-4 py-3">{t('orders.status')}</th>
                  <th className="px-4 py-3">{t('orders.proof')}</th>
                  <th className="px-4 py-3 text-right">{t('orders.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="cursor-pointer px-4 py-3 text-sm font-medium text-brand-600"
                    >
                      {order.number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {order.client ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ') || order.client.email : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(Number(order.total_amount))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[order.status] ?? 'neutral'}>
                        {t(`orders.status.${order.status}`, { defaultValue: order.status })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {order.proof_url ? (
                        <a
                          href={order.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
                        >
                          {t('orders.viewProof')}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'pending_validation' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="danger" onClick={() => openDecline(order)}>
                            <X className="h-4 w-4" />
                            {t('orders.decline')}
                          </Button>
                          <Button size="sm" onClick={() => openValidate(order)}>
                            <Check className="h-4 w-4" />
                            {t('orders.validate')}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right text-sm text-gray-400">—</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 p-4 dark:border-gray-800">
            <p className="text-sm text-gray-500">
              {t('pagination.of', {
                from: (pagination.current_page - 1) * pagination.per_page + 1,
                to: Math.min(pagination.current_page * pagination.per_page, pagination.total),
                total: pagination.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current_page <= 1}
                onClick={() => {
                  setPage(pagination.current_page - 1);
                  loadOrders(pagination.current_page - 1);
                }}
              >
                {t('pagination.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => {
                  setPage(pagination.current_page + 1);
                  loadOrders(pagination.current_page + 1);
                }}
              >
                {t('pagination.next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={mode === 'validate' ? t('orders.validateModalTitle') : t('orders.declineModalTitle')}
      >
        {selected && (
          <div className="flex flex-col gap-4">
            {errors && <Alert variant="error">{errors}</Alert>}
            <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('orders.number')}</span>
                <span className="font-medium text-gray-900 dark:text-white">{selected.number}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-gray-500">{t('orders.total')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(Number(selected.total_amount))}
                </span>
              </div>
              {selected.lines && (
                <ul className="mt-3 space-y-1 border-t border-gray-200 pt-3 dark:border-gray-700">
                  {selected.lines.map((line) => (
                    <li key={line.id} className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">
                        {line.label} × {line.quantity}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {formatCurrency(Number(line.line_total))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {selected.proof_url && (
                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                  <a
                    href={selected.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                  >
                    {t('orders.viewProof')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>

            {mode === 'validate' ? (
              <Select
                label={t('invoices.headerPaymentType')}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">{t('invoices.paymentCash')}</option>
                <option value="om">{t('invoices.paymentOm')}</option>
                <option value="momo">{t('invoices.paymentMomo')}</option>
              </Select>
            ) : (
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
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>
                {t('common.close')}
              </Button>
              {mode === 'validate' ? (
                <Button onClick={handleConfirm} isLoading={submitting}>
                  <Check className="h-4 w-4" />
                  {t('orders.confirmValidation')}
                </Button>
              ) : (
                <Button variant="danger" onClick={handleConfirm} isLoading={submitting}>
                  <X className="h-4 w-4" />
                  {t('orders.confirmDecline')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
