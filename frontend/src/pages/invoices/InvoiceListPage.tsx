import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { formatRelativeDate } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { canExportData } from '@/utils/exportPermissions';
import type { Invoice, InvoiceStatus } from '@/types/invoice';
import type { Agency, PaginationMeta } from '@/types/agency';

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat(currentLocale()).format(n)} FCFA`;
}

export function invoiceDetailPath(invoiceId: string, agencyId?: string): string {
  return agencyId ? `/agencies/${agencyId}/invoices/${invoiceId}` : `/invoices/${invoiceId}`;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  switch (status) {
    case 'paid':
      return <Badge variant="success">{t('invoices.statusPaid')}</Badge>;
    case 'partial':
      return <Badge variant="warning">{t('invoices.statusPartial')}</Badge>;
    case 'unpaid':
      return <Badge variant="error">{t('invoices.statusUnpaid')}</Badge>;
    case 'cancelled':
      return <Badge variant="neutral">{t('invoices.statusCancelled')}</Badge>;
  }
}

export default function InvoiceListPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [totals, setTotals] = useState({ revenue: 0, outstanding: 0, advances: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const status = searchParams.get('status') ?? '';
  const agencyId = fixedAgencyId ?? (searchParams.get('agency_id') ?? '');
  const clientId = searchParams.get('client_id') ?? '';
  const commercialId = searchParams.get('commercial_id') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  useEffect(() => {
    agenciesApi.list({ per_page: 100 }).then((res) => setAgencies(res.data ?? [])).catch(() => {});
  }, []);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await invoicesApi.list({
        search: search || undefined,
        status: (status as InvoiceStatus) || undefined,
        agency_id: agencyId || undefined,
        client_id: clientId || undefined,
        commercial_id: commercialId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        per_page: 15,
      });
      setInvoices(response.invoices.data);
      setMeta(response.invoices.meta);
      setTotals(response.totals);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('invoices.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, status, agencyId, clientId, commercialId, from, to, page, t]);

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

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('invoices');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('invoices.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {canExportData(currentUser) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('invoices.export')}
            </Button>
          )}
          <Button onClick={() => navigate(fixedAgencyId ? `/agencies/${fixedAgencyId}/invoices/new` : '/invoices/new')}>
            <Plus className="h-4 w-4" />
            {t('invoices.newInvoice')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.totalsRevenue')}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totals.revenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.totalsOutstanding')}</p>
          <p className="mt-1 text-xl font-semibold text-error-500">
            {formatCurrency(totals.outstanding)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.totalsAdvances')}</p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totals.advances)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <Input
              label={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('invoices.searchPlaceholder')}
            />
          </div>
          <Select label={t('invoices.filterStatus')} value={status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">{t('invoices.allStatuses')}</option>
            <option value="unpaid">{t('invoices.statusUnpaid')}</option>
            <option value="partial">{t('invoices.statusPartial')}</option>
            <option value="paid">{t('invoices.statusPaid')}</option>
            <option value="cancelled">{t('invoices.statusCancelled')}</option>
          </Select>
          {!fixedAgencyId && (
            <Select label={t('invoices.filterAgency')} value={agencyId} onChange={(e) => setFilter('agency_id', e.target.value)}>
              <option value="">{t('common.selectAllAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex items-end gap-3">
            <Input label={t('invoices.filterFrom')} type="date" value={from} onChange={(e) => setFilter('from', e.target.value)} />
            <Input label={t('invoices.filterTo')} type="date" value={to} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('invoices.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colCommercial')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colAgency')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colAdvance')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colBalance')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colStatus')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(invoiceDetailPath(inv.id, fixedAgencyId))}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {inv.number}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatRelativeDate(inv.invoice_date)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {inv.client
                        ? [inv.client.first_name, inv.client.last_name].filter(Boolean).join(' ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {inv.commercial
                        ? [inv.commercial.first_name, inv.commercial.last_name].filter(Boolean).join(' ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {inv.agency?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(inv.amount_paid)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(inv.balance_due)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-medium ${
                        inv.status === 'partial'
                          ? 'text-error-600 dark:text-error-400'
                          : 'text-gray-800 dark:text-gray-100'
                      }`}
                    >
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3">{<InvoiceStatusBadge status={inv.status} />}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(invoiceDetailPath(inv.id, fixedAgencyId));
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                        title={t('invoices.detailTitle', { number: inv.number })}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
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
    </div>
  );
}
