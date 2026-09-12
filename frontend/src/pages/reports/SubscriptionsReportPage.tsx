import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, RefreshCcw, XCircle, Clock, CalendarClock, TrendingUp, Receipt, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reportsApi, type SubscriptionsReportResponse } from '@/api/reports.api';
import { formatCurrency, formatNumber } from '@/utils/number';
import { currentLocale } from '@/i18n';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReportFilters, ReportStatCard, ReportBar } from '@/pages/reports/ReportFilters';

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'subscriptions.statusDraft',
  pending: 'subscriptions.statusPending',
  active: 'subscriptions.statusActive',
  suspended: 'subscriptions.statusSuspended',
  expired: 'subscriptions.statusExpired',
  cancelled: 'subscriptions.statusCancelled',
  renewed: 'subscriptions.statusRenewed',
};

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const d = new Date(Number(year), Number(m) - 1, 1);
  return d.toLocaleDateString(currentLocale(), { month: 'short', year: '2-digit' });
}

export default function SubscriptionsReportPage() {
  const { t } = useTranslation();

  const [report, setReport] = useState<SubscriptionsReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params = useMemo(
    () => ({ from: fromDate || undefined, to: toDate || undefined }),
    [fromDate, toDate],
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    reportsApi
      .subscriptions(params)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch(() => {
        if (active) setReport(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  const maxTrend = Math.max(0, ...(report?.trend ?? []).map((e) => e.new_subscriptions));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.subscriptionsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.subscriptionsSubtitle')}</p>
      </div>

      <ReportFilters from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />

      {isLoading ? (
        <SkeletonTable />
      ) : !report ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('reports.noData')}</p>
        </div>
      ) : (
        <>
          {report.period && (
            <p className="text-sm text-gray-400">
              {t('reports.period')}: {new Date(report.period.from).toLocaleDateString(currentLocale())} →{' '}
              {new Date(report.period.to).toLocaleDateString(currentLocale())}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportStatCard
              icon={Receipt}
              label={t('reports.subscriptionsCount')}
              value={formatNumber(report.totals.subscriptions)}
              tone="brand"
            />
            <ReportStatCard
              icon={CalendarCheck}
              label={t('reports.activeSubscriptions')}
              value={formatNumber(report.totals.active)}
              tone="green"
            />
            <ReportStatCard
              icon={RefreshCcw}
              label={t('reports.renewedSubscriptions')}
              value={formatNumber(report.totals.renewed)}
              tone="sky"
            />
            <ReportStatCard
              icon={XCircle}
              label={t('reports.cancelledSubscriptions')}
              value={formatNumber(report.totals.cancelled)}
              tone="purple"
            />
            <ReportStatCard
              icon={Clock}
              label={t('reports.expiredSubscriptions')}
              value={formatNumber(report.totals.expired)}
              tone="amber"
            />
            <ReportStatCard
              icon={CalendarClock}
              label={t('reports.expiringSoon')}
              value={formatNumber(report.totals.expiring_soon)}
              tone="amber"
            />
            <ReportStatCard
              icon={TrendingUp}
              label={t('reports.mrMaintained')}
              value={formatCurrency(report.totals.mr_maintenu)}
              tone="green"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('reports.byStatus')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-5 py-3 font-medium">{t('reports.name')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('reports.count')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('reports.mrr')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {Object.entries(report.by_status).map(([status, value]) => (
                      <tr key={status} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3 text-gray-800 dark:text-gray-100">
                          {t(STATUS_LABEL_KEYS[status] ?? status)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(value.count)}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(value.mrr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <Package className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('reports.byPack')}</h2>
              </div>
              {report.by_pack.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="px-5 py-3 font-medium">{t('reports.name')}</th>
                        <th className="px-5 py-3 text-right font-medium">{t('reports.count')}</th>
                        <th className="px-5 py-3 text-right font-medium">{t('reports.revenue')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {report.by_pack.map((row) => (
                        <tr key={row.pack} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{row.pack}</td>
                          <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.count)}</td>
                          <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('reports.subscriptionTrend')}</h2>
            </div>
            {report.trend.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
            ) : (
              <div className="flex flex-col gap-3 p-5">
                {report.trend.map((entry) => (
                  <div key={entry.month} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-sm text-gray-600 dark:text-gray-300">{formatMonth(entry.month)}</span>
                    <div className="flex-1">
                      <ReportBar value={entry.new_subscriptions} max={maxTrend} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                      {formatNumber(entry.new_subscriptions)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}