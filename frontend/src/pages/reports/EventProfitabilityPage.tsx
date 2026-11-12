import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, type EventProfitabilityResponse } from '@/api/reports.api';
import { formatCurrency, formatNumber } from '@/utils/number';
import { currentLocale } from '@/i18n';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReportFilters } from '@/pages/reports/ReportFilters';

/**
 * T3.14 — rentabilité d'un événement.
 *
 * Décision client du 12/11/2026 : l'événement est le séminaire vendu au
 * catalogue. Ventes de la période − dépenses rattachées = marge.
 */
export default function EventProfitabilityPage() {
  const { t } = useTranslation();

  const [report, setReport] = useState<EventProfitabilityResponse | null>(null);
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
      .events(params)
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.eventsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.eventsSubtitle')}</p>
      </div>

      <ReportFilters from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />

      {isLoading ? (
        <SkeletonTable />
      ) : !report || report.rows.length === 0 ? (
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

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('reports.colEvent')}</th>
                  <th className="px-5 py-3 font-medium">{t('reports.colAgency')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('reports.colTickets')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('reports.colSales')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('reports.colExpenses')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('reports.colMargin')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('reports.colMarginRate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report.rows.map((row) => (
                  <tr key={row.service_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{row.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.agency ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.tickets)}</td>
                    <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(row.expenses)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${row.margin < 0 ? 'text-error-600' : 'text-success-600'}`}>
                      {formatCurrency(row.margin)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {row.margin_rate != null ? `${row.margin_rate} %` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-100 dark:border-gray-800">
                <tr className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <td className="px-5 py-3" colSpan={3}>
                    {t('reports.total')}
                  </td>
                  <td className="px-5 py-3 text-right">{formatCurrency(report.totals.revenue)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(report.totals.expenses)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(report.totals.margin)}</td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
