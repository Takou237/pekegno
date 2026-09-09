import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { statsApi } from '@/api/stats.api';
import { invoicesApi, type InvoiceIndexResponse } from '@/api/invoices.api';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { currentLocale } from '@/i18n';
import { todayLocal } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { ValidationBadge } from '@/pages/invoices/PendingInvoicesPage';
import type { DashboardStats } from '@/types/stats';
import type { Invoice } from '@/types/invoice';

function StatCard({
  label,
  value,
  icon,
  tone,
  sub,
  to,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
  sub?: string;
  to?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );

  return to ? (
    <Link to={to} className="transition hover:border-brand-200 hover:shadow-sm dark:hover:border-brand-500/40">
      {content}
    </Link>
  ) : (
    content
  );
}

export default function CashierDashboardPage() {
  const { t } = useTranslation();
  const today = todayLocal();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [pending, setPending] = useState<Invoice[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const results = [
      { key: 'stats', fn: () => statsApi.dashboard({ from: today, to: today }) },
      { key: 'invoices', fn: () => invoicesApi.list({ per_page: 8 }) },
      { key: 'pending', fn: () => invoicesApi.list({ validation_status: 'pending', per_page: 5 }) },
    ];
    Promise.allSettled(results.map((r) => r.fn()))
      .then((settled) => {
        if (!active) return;
        settled.forEach((result, i) => {
          const key = results[i].key;
          if (result.status !== 'fulfilled') return;
          switch (key) {
            case 'stats':
              setStats(result.value as DashboardStats);
              break;
            case 'invoices':
              setRecentInvoices((result.value as InvoiceIndexResponse).invoices.data ?? []);
              break;
            case 'pending': {
              const res = result.value as InvoiceIndexResponse;
              setPending(res.invoices.data ?? []);
              setPendingTotal(res.invoices.meta?.total ?? 0);
              break;
            }
          }
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [today]);

  if (loading) {
    return <SkeletonTable rows={3} />;
  }

  const unpaidCount = (stats?.invoices_total ?? 0) - (stats?.invoices_paid ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('dashboard.cashier.title')}
        </h1>
        <span className="text-sm text-gray-400">
          {new Date(today).toLocaleDateString(currentLocale())}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.cashier.todayRevenue')}
          value={formatCurrency(stats?.revenue ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('dashboard.cashier.todayInvoices')}
          value={String(stats?.invoices_total ?? 0)}
          icon={<Receipt className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
          sub={`${stats?.invoices_paid ?? 0} ${t('dashboard.cashier.todayPaid')} · ${unpaidCount} ${t('dashboard.cashier.todayUnpaid')}`}
        />
        <StatCard
          label={t('dashboard.cashier.todayCollections')}
          value={formatCurrency(stats?.payments_total ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
        />
        <StatCard
          label={t('dashboard.cashier.pendingTitle')}
          value={String(pendingTotal)}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          to="/invoices/pending"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {t('dashboard.cashier.recentInvoices')}
            </h2>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {t('dashboard.viewAllAgencies')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.invoices')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.clients')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('common.status')}</th>
                    <th className="pb-2 text-right font-medium">{t('dashboard.revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                        <Link to={`/invoices/${inv.id}`} className="hover:text-brand-600">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {inv.client_label ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {inv.validation_status === 'pending' ? (
                          <ValidationBadge status={inv.validation_status} />
                        ) : inv.status === 'paid' ? (
                          <Badge variant="success">{t('dashboard.invoicesPaid')}</Badge>
                        ) : inv.status === 'partial' ? (
                          <Badge variant="warning">{t('dashboard.invoicesPartial')}</Badge>
                        ) : (
                          <Badge variant="error">{t('dashboard.invoicesUnpaid')}</Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {formatCurrency(inv.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {t('dashboard.cashier.pendingTitle')}
            </h2>
            <Link
              to="/invoices/pending"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {t('dashboard.cashier.viewPending')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-gray-400">{t('invoices.pendingEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((inv) => (
                <Link
                  key={inv.id}
                  to="/invoices/pending"
                  className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:hover:border-brand-500/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <Receipt className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                      {inv.number}
                    </p>
                    <p className="truncate text-xs text-gray-400">{inv.client_label ?? '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(inv.total_amount)}
                    </p>
                    <p className="text-xs text-gray-400">{inv.agency?.name ?? '—'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        to="/invoices/quick"
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500/40"
      >
        <ShoppingCart className="h-4 w-4 text-amber-500" />
        {t('dashboard.cashier.newQuickSale')}
      </Link>
    </div>
  );
}