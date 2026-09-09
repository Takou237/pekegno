import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, XCircle, FileText, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeDate } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { canViewAgencies } from '@/utils/catalogPermissions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import type { Invoice, InvoiceValidationStatus, InvoiceSource } from '@/types/invoice';
import type { Agency, PaginationMeta } from '@/types/agency';

export function ValidationBadge({ status }: { status: InvoiceValidationStatus }) {
  const { t } = useTranslation();
  switch (status) {
    case 'validated':
      return <Badge variant="success">{t('invoices.validationValidated')}</Badge>;
    case 'rejected':
      return <Badge variant="error">{t('invoices.validationRejected')}</Badge>;
    case 'pending':
      return <Badge variant="warning">{t('invoices.validationPending')}</Badge>;
  }
}

function SourceLabel({ source }: { source: InvoiceSource | null }) {
  const { t } = useTranslation();
  if (!source) return <span className="text-gray-400">—</span>;
  const key =
    source === 'client_self' ? 'invoices.sourceClientSelf' : source === 'commercial_online' ? 'invoices.sourceCommercialOnline' : 'invoices.sourceInPerson';
  return <span>{t(key)}</span>;
}

export default function PendingInvoicesPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const canValidateInvoice = ['super-admin', 'direction-generale', 'responsable-agence', 'caissier'].includes(
    currentUser?.role?.name ?? ''
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [page, setPage] = useState(1);

  const [rejectTarget, setRejectTarget] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const agencyId = fixedAgencyId ?? (searchParams.get('agency_id') ?? '');

  useEffect(() => {
    if (!canViewAgencies(currentUser)) return;
    agenciesApi.list({ per_page: 100 }).then((res) => setAgencies(res.data ?? [])).catch(() => {});
  }, [currentUser]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await invoicesApi.list({
        validation_status: 'pending',
        agency_id: agencyId || undefined,
        page,
        per_page: 15,
      });
      setInvoices(response.invoices.data);
      setMeta(response.invoices.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('invoices.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, page, t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function setFilter(key: string, value: string) {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params, { replace: true });
  }

  function openReject(invoice: Invoice) {
    setRejectTarget(invoice);
    setRejectReason('');
    setRejectError(null);
  }

  async function handleValidate(invoice: Invoice) {
    setActionId(invoice.id);
    try {
      await invoicesApi.validate(invoice.id);
      showToast(t('invoices.validated', { number: invoice.number }), 'success');
      fetchInvoices();
    } catch (error) {
      showToast(extractErrorMessage(error, t('invoices.validateFailed')), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(event: FormEvent) {
    event.preventDefault();
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError(t('invoices.rejectReasonRequired'));
      return;
    }
    setRejectSubmitting(true);
    setRejectError(null);
    try {
      await invoicesApi.reject(rejectTarget.id, { rejection_reason: rejectReason.trim() });
      showToast(t('invoices.rejected', { number: rejectTarget.number }), 'success');
      setRejectTarget(null);
      fetchInvoices();
    } catch (error) {
      const msg = extractErrorMessage(error, t('invoices.rejectFailed'));
      setRejectError(msg);
      if (msg) showToast(msg, 'error');
    } finally {
      setRejectSubmitting(false);
    }
  }

  const backPath = fixedAgencyId ? `/agencies/${fixedAgencyId}/invoices` : '/invoices';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={backPath}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.title')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.pendingTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('invoices.pendingSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {!fixedAgencyId && canViewAgencies(currentUser) && (
            <Select label={t('invoices.filterAgency')} value={agencyId} onChange={(e) => setFilter('agency_id', e.target.value)}>
              <option value="">{t('common.selectAllAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('invoices.pendingEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colAgency')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colSource')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colValidation')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colAdvance')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  {canValidateInvoice && (
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <Link
                        to={fixedAgencyId ? `/agencies/${fixedAgencyId}/invoices/${inv.id}` : `/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1.5 font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                      >
                        <FileText className="h-4 w-4 text-gray-400" />
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatRelativeDate(inv.invoice_date)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.client_label ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.agency?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      <SourceLabel source={inv.source} />
                    </td>
                    <td className="px-5 py-3">
                      <ValidationBadge status={inv.validation_status} />
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {Number(inv.declared_advance ?? 0) > 0 ? formatCurrency(inv.declared_advance) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    {canValidateInvoice && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleValidate(inv)}
                          isLoading={actionId === inv.id}
                          disabled={actionId !== null && actionId !== inv.id}
                        >
                          <Check className="h-4 w-4" />
                          {t('invoices.validate')}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => openReject(inv)}>
                          <XCircle className="h-4 w-4" />
                          {t('invoices.reject')}
                        </Button>
                      </div>
                    </td>
                  )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={t('invoices.rejectTitle', { number: rejectTarget?.number ?? '' })}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleReject} className="flex flex-col gap-4">
          {rejectError && <Alert variant="error">{rejectError}</Alert>}
          <Input
            label={t('invoices.rejectReason')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            error={rejectError ?? undefined}
            placeholder={t('invoices.rejectReasonPlaceholder')}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" isLoading={rejectSubmitting} disabled={!rejectReason.trim()}>
              {t('invoices.reject')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
