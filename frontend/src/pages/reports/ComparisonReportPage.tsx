import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Globe, MapPin, Building2, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reportsApi, type ComparisonDimension, type ComparisonReportResponse } from '@/api/reports.api';
import { formatCurrency, formatNumber } from '@/utils/number';
import { currentLocale } from '@/i18n';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReportFilters, ReportStatCard, ReportBar } from '@/pages/reports/ReportFilters';

const DIMENSIONS: ComparisonDimension[] = ['country', 'city', 'agency'];

const DIMENSION_ICONS: Record<ComparisonDimension, typeof Globe> = {
  country: Globe,
  city: MapPin,
  agency: Building2,
};

export default function ComparisonReportPage() {
  const { t } = useTranslation();

  const [report, setReport] = useState<ComparisonReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dimension, setDimension] = useState<ComparisonDimension>('agency');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params = useMemo(
    () => ({ dimension, from: fromDate || undefined, to: toDate || undefined }),
    [dimension, fromDate, toDate],
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    reportsApi
      .comparison(params)
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

  const maxRevenue = Math.max(0, ...(report?.data ?? []).map((e) => e.revenue));
  const DimensionIcon = DIMENSION_ICONS[dimension];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.comparisonTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.comparisonSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="w-full sm:w-56">
          <Select label={t('reports.dimension')} value={dimension} onChange={(e) => setDimension(e.target.value as ComparisonDimension)}>
            <option value="country">{t('reports.dimensionCountry')}</option>
            <option value="city">{t('reports.dimensionCity')}</option>
            <option value="agency">{t('reports.dimensionAgency')}</option>
          </Select>
        </div>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReportStatCard
              icon={TrendingUp}
              label={t('reports.totalRevenue')}
              value={formatCurrency(report.total_revenue)}
              tone="green"
            />
            <ReportStatCard
              icon={DimensionIcon}
              label={t('reports.entriesCount')}
              value={formatNumber(report.data.length)}
              tone="brand"
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <DimensionIcon className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('reports.comparisonData')}</h2>
            </div>
            {report.data.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-5 py-3 font-medium">{t('reports.rank')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.name')}</th>
                      <th className="px-5 py-3 text-right font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="h-3 w-3" />
                          {t('reports.invoicesCount')}
                        </span>
                      </th>
                      <th className="px-5 py-3 text-right font-medium">{t('reports.revenue')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.share')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.data.map((row, index) => (
                      <tr key={row.id ?? row.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{row.label}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.invoices)}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                          {formatCurrency(row.revenue)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-36">
                              <ReportBar value={row.revenue} max={maxRevenue} />
                            </div>
                            <span className="w-12 text-right text-sm font-medium text-gray-700 dark:text-gray-200">
                              {row.share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}