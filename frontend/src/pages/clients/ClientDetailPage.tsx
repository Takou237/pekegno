import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients.api';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { currentLocale } from '@/i18n';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import type { ClientListItem } from '@/types/client';
import type { Invoice } from '@/types/invoice';
import type { PaginationMeta } from '@/types/agency';

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat(currentLocale()).format(n)} FCFA`;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [client, setClient] = useState<ClientListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesMeta, setInvoicesMeta] = useState<PaginationMeta | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicePage, setInvoicePage] = useState(1);

  useEffect(() => {
    if (!id) return;
    async function fetchClient() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await clientsApi.get(id);
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

  const totalRevenue = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0);
  }, [invoices]);

  const totalInvoices = invoicesMeta?.total ?? invoices.length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (loadError || !client) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/clients"
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
          to="/clients"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      {/* Invoice history table */}
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('clientDetail.invoices')}
          </h2>
        </div>
        {invoicesLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
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
    </div>
  );
}
