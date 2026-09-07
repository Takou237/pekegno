import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingCart, Coins, Star, FileText, Target, Building2, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { commercialsApi } from '@/api/commercials.api';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import { ValidationBadge } from '@/pages/invoices/PendingInvoicesPage';
import type { Commercial, CommercialStats } from '@/types/commercial';
import type { Invoice } from '@/types/invoice';

export default function CommercialSelfDashboardPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await commercialsApi.list({ per_page: 100 });
      const mine = (res.data ?? []).find((c) => c.user_id === user?.id) ?? null;
      setCommercial(mine);
      if (mine) {
        const [s, invRes] = await Promise.all([
          commercialsApi.stats(mine.id),
          invoicesApi.list({ commercial_id: mine.id, per_page: 10 }),
        ]);
        setStats(s);
        setInvoices(invRes.invoices.data);
      }
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('commercials.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleDelete(inv: Invoice) {
    if (!window.confirm(t('invoices.cancelTitle'))) return;
    setDeletingId(inv.id);
    try {
      await invoicesApi.cancel(inv.id);
      showToast(t('invoices.cancelled'), 'success');
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('invoices.cancelFailed')), 'error');
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (loadError) {
    return <p className="text-sm text-error-500">{loadError}</p>;
  }

  if (!commercial) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.selfTitle')}</h1>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfNoProfile')}</p>
        </div>
      </div>
    );
  }

  const firstName = commercial.first_name && commercial.last_name
    ? `${commercial.first_name} ${commercial.last_name}`
    : commercial.first_name || commercial.email || '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.selfTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {firstName} · {commercial.agency?.name ?? t('commercial.selfNoAgency')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => (window.location.href = '/invoices/quick')}>
            <Plus className="h-4 w-4" />
            {t('commercial.selfNewSale')}
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/invoices/new')}>
            <FileText className="h-4 w-4" />
            {t('commercial.selfNewInvoice')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfTurnover')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats?.turnover ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfSales')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats?.sales_count ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfCommissions')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats?.commissions ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfPoints')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{commercial.points_balance}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => (window.location.href = `/commercials/${commercial.id}`)}>
          <Target className="h-4 w-4" />
          {t('commercial.selfMyDetail')}
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = '/opportunities')}>
          <Target className="h-4 w-4" />
          {t('nav.opportunities')}
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = '/companies')}>
          <Building2 className="h-4 w-4" />
          {t('nav.companies')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('commercial.selfRecentInvoices')}</h2>
          <Link to={`/invoices?commercial_id=${commercial.id}`} className="text-sm font-medium text-brand-600 hover:underline">
            {t('commercial.selfViewAll')}
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('invoices.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colStatus')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.invoice_date}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.client_label ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3">
                      {inv.validation_status === 'pending' ? (
                        <ValidationBadge status={inv.validation_status} />
                      ) : (
                        <InvoiceStatusBadge status={inv.status} />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {inv.validation_status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(inv)}
                          disabled={deletingId === inv.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 dark:text-error-400 dark:hover:bg-error-500/10"
                          title={t('invoices.cancelInvoice')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === inv.id ? t('common.loading') : t('invoices.cancelInvoice')}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
