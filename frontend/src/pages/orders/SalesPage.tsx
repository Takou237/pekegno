import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ArrowLeft, Plus, ShoppingCart, Trash2, Upload } from 'lucide-react';
import { ordersApi } from '@/api/orders.api';
import { clientsApi } from '@/api/clients.api';
import { produitsApi } from '@/api/produits.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import type { AutocompleteOption } from '@/components/ui/Autocomplete';
import type { Order, OrderLinePayload, OrderStatus } from '@/types/order';
import type { ProduitSearchItem } from '@/types/produit';

interface SaleLineDraft {
  key: string;
  service_id?: string;
  label: string;
  unit_price: number;
  quantity: number;
}

const STATUS_VARIANTS: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'error'> = {
  draft: 'neutral',
  confirmed: 'warning',
  pending_validation: 'warning',
  completed: 'success',
  cancelled: 'error',
};

function orderStatusLabel(status: OrderStatus, t: TFunction): string {
  return t(`orders.status.${status}`, { defaultValue: status });
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function SalesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Liste
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; total: number; per_page: number }>({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 15,
  });
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Formulaire nouvelle vente
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [vatRate, setVatRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<SaleLineDraft[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');
  const serviceResultsRef = useRef<ProduitSearchItem[]>([]);
  // Preuve
  const [proofUrl, setProofUrl] = useState('');
  const [proofPath, setProofPath] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadOrders = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await ordersApi.list({
          page,
          status: statusFilter || undefined,
          search: search || undefined,
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
    [statusFilter, search, showToast, t],
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
    [lines],
  );
  const total = useMemo(() => Math.max(0, subtotal - (Number(discount) || 0)), [subtotal, discount]);

  async function handleAddService(id: string) {
    const service = serviceResultsRef.current.find((s) => s.id === id);
    if (!service) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random()}`,
        service_id: service.id,
        label: service.name,
        unit_price: Number(service.effective_price ?? service.price ?? 0),
        quantity: Number(selectedQty) || 1,
      },
    ]);
    setSelectedService('');
    setSelectedQty('1');
  }

  function handleSelect(id: string) {
    setSelectedService(id);
  }

  function handlePick(option: AutocompleteOption) {
    handleAddService(option.id);
  }

  async function handleProofFile(file: File | null) {
    if (!file) {
      return;
    }
    setUploadingProof(true);
    setErrors((prev) => ({ ...prev, proof: '' }));
    try {
      const res = await uploadsApi.uploadProof(file);
      setProofUrl(res.url);
      setProofPath(res.path);
    } catch (error) {
      setErrors((prev) => ({ ...prev, proof: extractErrorMessage(error, t('orders.proofUploadFailed')) }));
    } finally {
      setUploadingProof(false);
    }
  }

  function handleSubmitDraft(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setErrors((prev) => ({ ...prev, lines: t('orders.addAtLeastOneLine') }));
      return;
    }
    setErrors({});
    setSubmitting(true);
    void createAndSubmit();
  }

  async function createAndSubmit() {
    try {
      const order = await ordersApi.create({
        client_id: clientId,
        discount: Number(discount) || 0,
        vat_rate: Number(vatRate) || 0,
        notes: notes || undefined,
        lines: lines.map<OrderLinePayload>((l) => ({
          line_type: l.service_id ? 'catalog' : 'manual',
          service_id: l.service_id,
          label: l.label,
          unit_price: l.unit_price,
          quantity: l.quantity,
        })),
      });
      await ordersApi.submit(order.id, { proof_path: proofPath, proof_url: proofUrl });
      showToast(t('orders.submittedSuccess'), 'success');
      setShowForm(false);
      resetForm();
      loadOrders(1);
    } catch (error) {
      setErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('orders.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setClientId('');
    setDiscount('0');
    setVatRate('0');
    setNotes('');
    setLines([]);
    setProofUrl('');
    setProofPath('');
    setErrors({});
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('orders.backToHome')}
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('orders.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('orders.subtitle')}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {t('orders.newSale')}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmitDraft}
          noValidate
          className="flex flex-col gap-6 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('orders.newSaleTitle')}</h2>
          {Object.keys(errors).length > 0 && <Alert variant="error">{Object.values(errors).join(' ')}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Autocomplete
              label={t('invoices.headerClient')}
              placeholder={t('invoices.headerClientPlaceholder')}
              value={clientId}
              onChange={setClientId}
              error={errors.client_id}
              fetchOptions={async (query) => {
                const res = await clientsApi.search(query.trim());
                return res.map((c) => ({
                  id: c.id,
                  label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                  subtitle: [c.email, c.client_number].filter(Boolean).join(' — '),
                }));
              }}
            />
            <div className="flex flex-col justify-end gap-4 sm:flex-row sm:items-end">
              <div className="w-full sm:w-40">
                <Input
                  label={t('orders.discount')}
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-40">
                <Input
                  label={`${t('orders.vatRate')} (%)`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Lignes */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-3 p-4">
              <Autocomplete
                label={t('orders.addItem')}
                placeholder={t('orders.itemPlaceholder')}
                value={selectedService}
                onChange={handleSelect}
                onPick={handlePick}
                error={errors.lines}
                fetchOptions={async (query) => {
                  const res = await produitsApi.search(query.trim());
                  serviceResultsRef.current = res;
                  return res.map((s) => ({
                    id: s.id,
                    label: s.name,
                    subtitle: `${formatCurrency(Number(s.effective_price ?? s.price))}${
                      s.has_promotion ? ' · promo' : ''
                    }${s.type === 'formation' ? ` · ${t('orders.formationTag')}` : ''}`,
                  }));
                }}
              />
              <div className="w-full sm:w-24">
                <Input
                  label={t('orders.qty')}
                  type="number"
                  min={1}
                  step="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(e.target.value)}
                />
              </div>
            </div>

            {lines.length > 0 && (
              <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                {lines.map((line) => (
                  <li key={line.key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{line.label}</p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(line.unit_price)} × {line.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(line.unit_price * line.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        className="rounded-lg p-1 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                        aria-label={t('common.close')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Preuve */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('orders.proofLabel')}
            </label>
            <div className="flex flex-wrap items-center gap-3">
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
              {proofUrl && <span className="text-sm text-success-600">{t('orders.proofUploaded')}</span>}
            </div>
            {errors.proof && <p className="mt-1 text-xs text-error-600">{errors.proof}</p>}
            <p className="mt-1 text-xs text-gray-400">{t('orders.proofHint')}</p>
          </div>

          <div className="mb-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('invoices.headerComment')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('invoices.headerCommentPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('orders.total')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                {t('common.close')}
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                disabled={uploadingProof || !proofUrl}
              >
                <ShoppingCart className="h-4 w-4" />
                {t('orders.submitForValidation')}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Liste */}
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <Input
            label={t('orders.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
            placeholder={t('orders.searchPlaceholder')}
          />
          <Select
            label={t('orders.filterStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
          >
            <option value="">{t('orders.allStatuses')}</option>
            {(['draft', 'confirmed', 'pending_validation', 'completed', 'cancelled'] as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s, t)}
              </option>
            ))}
          </Select>
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
                  <th className="px-4 py-3">{t('orders.date')}</th>
                  <th className="px-4 py-3">{t('orders.total')}</th>
                  <th className="px-4 py-3">{t('orders.status')}</th>
                  <th className="px-4 py-3">{t('orders.proof')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-brand-600">{order.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {order.client ? [order.client.first_name, order.client.last_name].filter(Boolean).join(' ') || order.client.email : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(order.order_date)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(Number(order.total_amount))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[order.status] ?? 'default'}>
                        {orderStatusLabel(order.status, t)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {order.proof_url ? (
                        <a
                          href={order.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-brand-600 hover:underline"
                        >
                          {t('orders.viewProof')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={pagination.current_page}
              lastPage={pagination.last_page}
              total={pagination.total}
              perPage={pagination.per_page}
              onPageChange={(p) => loadOrders(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
