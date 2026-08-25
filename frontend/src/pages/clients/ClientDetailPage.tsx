import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Activity as ActivityIcon, Phone, Mail, MessageCircle, Clock, Check, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients.api';
import { invoicesApi } from '@/api/invoices.api';
import { activitiesApi } from '@/api/activities.api';
import type { Activity } from '@/types/activity';
import { ACTIVITY_TYPE_LABELS, type ActivityType } from '@/types/activity';
import { extractErrorMessage } from '@/api/errors';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';
import { Badge } from '@/components/ui/Badge';
import { SkeletonDetail,
  SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import type { ClientListItem } from '@/types/client';
import type { Invoice } from '@/types/invoice';
import type { PaginationMeta } from '@/types/agency';

export default function ClientDetailPage() {
  const { id, countryId } = useParams<{ id: string; countryId?: string }>();
  const { t } = useTranslation();

  const backToClients = countryId ? `/countries/${countryId}/clients` : '/clients';

  const [client, setClient] = useState<ClientListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesMeta, setInvoicesMeta] = useState<PaginationMeta | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicePage, setInvoicePage] = useState(1);

  const [tab, setTab] = useState<'invoices' | 'timeline'>('invoices');
  const [timelineActivities, setTimelineActivities] = useState<Activity[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetchClient() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await clientsApi.get(id!);
        setClient(data);
      } catch (error) {
        setLoadError(extractErrorMessage(error, t('clientDetail.loadFailed')));
      } finally {
        setIsLoading(false);
      }
    }
    fetchClient();
  }, [id, t]);

  useEffect(() => {
    if (!id) return;
    async function fetchInvoices() {
      setInvoicesLoading(true);
      try {
        const response = await invoicesApi.list({ client_id: id, per_page: 15, page: invoicePage });
        setInvoices(response.invoices.data);
        setInvoicesMeta(response.invoices.meta);
      } catch {
        // silently fail for invoices; the client detail is the priority
      } finally {
        setInvoicesLoading(false);
      }
    }
    fetchInvoices();
  }, [id, invoicePage]);

  useEffect(() => {
    if (tab !== 'timeline' || !client) return;
    setTimelineLoading(true);
    activitiesApi.list({ subject_type: 'App\\Models\\User', subject_id: client.id, per_page: 50 })
      .then((res) => setTimelineActivities(res.data))
      .catch(() => {})
      .finally(() => setTimelineLoading(false));
  }, [tab, client]);

  const totalRevenue = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0);
  }, [invoices]);

  const receivables = useMemo(() => {
    return invoices
      .filter((inv) => !inv.is_cancelled)
      .reduce((sum, inv) => sum + Number(inv.balance_due ?? 0), 0);
  }, [invoices]);

  const totalInvoices = invoicesMeta?.total ?? invoices.length;

  if (isLoading) {
    return (
      <SkeletonDetail />
    );
  }

  if (loadError || !client) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to={backToClients}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('clientDetail.backToClients')}
        </Link>
        <p className="text-sm text-error-500">{loadError ?? t('clientDetail.loadFailed')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={backToClients}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('clientDetail.backToClients')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {[client.first_name, client.last_name].filter(Boolean).join(' ') || client.email}
              </h1>
              {client.client_number && (
                <Badge variant="neutral">{client.client_number}</Badge>
              )}
              {client.is_active ? (
                <Badge variant="success">{t('common.active')}</Badge>
              ) : (
                <Badge variant="error">{t('common.inactive')}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('clientDetail.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('clients.email')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{client.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('clients.phone')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{client.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('clients.city')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{client.city ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('clients.country')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{client.country ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <dt className="text-sm font-medium text-gray-500">{t('clients.address')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{client.address ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clientDetail.invoices')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {totalInvoices}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clientDetail.totalRevenue')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('clientDetail.receivables')}</p>
          <p className="mt-1 text-2xl font-semibold text-error-500">
            {formatCurrency(receivables)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/50">
        <button onClick={() => setTab('invoices')} className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'invoices' ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('clientDetail.invoices')}
        </button>
        <button onClick={() => setTab('timeline')} className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === 'timeline' ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
          {t('clientDetail.timeline', 'Timeline')}
        </button>
      </div>

      {/* Invoice history table */}
      {tab === 'invoices' && (
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('clientDetail.invoices')}
          </h2>
        </div>
        {invoicesLoading ? (
          <SkeletonTable rows={3} />
        ) : invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('clientDetail.noInvoices')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {inv.number}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(inv.invoice_date).toLocaleDateString(currentLocale())}
                    </td>
                    <td className="px-5 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="inline-flex rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                        title={t('common.viewDetails')}
                      >
                        <FileText className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invoicesMeta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={invoicesMeta.current_page}
              lastPage={invoicesMeta.last_page}
              total={invoicesMeta.total}
              perPage={invoicesMeta.per_page}
              onPageChange={setInvoicePage}
            />
          </div>
        )}
      </div>
      )}

      {tab === 'timeline' && (
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('clientDetail.timeline', 'Timeline')}
          </h2>
        </div>
        {timelineLoading ? (
          <SkeletonTable rows={3} />
        ) : timelineActivities.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            {t('clientDetail.noTimeline', 'No activities yet.')}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {timelineActivities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 px-5 py-4">
                <div className={`mt-0.5 rounded-full p-1.5 ${act.completed_at ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                  {act.completed_at ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{act.title}</span>
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {ACTIVITY_TYPE_LABELS[act.type as ActivityType] ?? act.type}
                    </span>
                  </div>
                  {act.notes && <p className="mt-1 text-sm text-gray-500 line-clamp-2">{act.notes}</p>}
                  {act.outcome && <p className="mt-1 text-sm text-green-600">{act.outcome}</p>}
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    {act.due_at && <span>Échéance: {new Date(act.due_at).toLocaleDateString()}</span>}
                    {act.completed_at && <span>Complété: {new Date(act.completed_at).toLocaleDateString()}</span>}
                    {act.assignee && <span>Assigné: {act.assignee.first_name} {act.assignee.last_name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
