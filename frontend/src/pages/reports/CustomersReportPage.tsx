import { useEffect, useMemo, useState } from 'react';
import { Users, UserCheck, Wallet, Trophy, Rocket, Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reportsApi, type CustomersReportResponse } from '@/api/reports.api';
import { formatCurrency, formatNumber } from '@/utils/number';
import { currentLocale } from '@/i18n';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReportFilters, ReportStatCard } from '@/pages/reports/ReportFilters';

export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function CustomersReportPage() {
  const { t } = useTranslation();

  const [report, setReport] = useState<CustomersReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [placeCountry, setPlaceCountry] = useState('');
  const [placeCity, setPlaceCity] = useState('');
  const [placeOptions, setPlaceOptions] = useState<{ countries: string[]; cities: string[] }>({ countries: [], cities: [] });

  const params = useMemo(
    () => ({ from: fromDate || undefined, to: toDate || undefined, country: placeCountry || undefined, city: placeCity || undefined }),
    [fromDate, toDate, placeCountry, placeCity],
  );

  const selectClass =
    'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    reportsApi
      .customers(params)
      .then((data) => {
        if (!active) return;
        setReport(data);
        if (data.place_options) setPlaceOptions(data.place_options);
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('reports.customersTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.customersSubtitle')}</p>
      </div>

      <ReportFilters from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />

      {/* Rapport limité aux clients d'un pays et/ou d'une ville. */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('reports.placeCountry')}
          <select value={placeCountry} onChange={(e) => setPlaceCountry(e.target.value)} className={selectClass}>
            <option value="">{t('reports.allCountries')}</option>
            {placeOptions.countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          {t('reports.placeCity')}
          <select value={placeCity} onChange={(e) => setPlaceCity(e.target.value)} className={selectClass}>
            <option value="">{t('reports.allCities')}</option>
            {placeOptions.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {(placeCountry || placeCity) && (
          <button
            type="button"
            onClick={() => { setPlaceCountry(''); setPlaceCity(''); }}
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('reports.resetPlace')}
          </button>
        )}
      </div>

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

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <ReportStatCard
              icon={Users}
              label={t('reports.clientsTotal')}
              value={formatNumber(report.totals.clients_total)}
              tone="brand"
            />
            <ReportStatCard
              icon={UserCheck}
              label={t('reports.clientsActive')}
              value={formatNumber(report.totals.clients_active)}
              tone="sky"
            />
            <ReportStatCard
              icon={Wallet}
              label={t('reports.customersTurnover')}
              value={formatCurrency(report.totals.turnover)}
              tone="purple"
            />
          </div>

          <DetailSection title={t('reports.topClients')}>
            {report.top_clients.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-5 py-3 font-medium">{t('reports.rank')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.client')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('reports.customerOrders')}</th>
                      <th className="px-5 py-3 text-right font-medium">{t('reports.turnover')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.top_clients.map((row, index) => (
                      <tr key={row.client_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{row.client}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.orders)}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                          {formatCurrency(row.turnover)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DetailSection>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <DetailSection title={t('reports.byCommercial')}>
              {report.by_commercial.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="px-5 py-3 font-medium">{t('reports.commercial')}</th>
                        <th className="px-5 py-3 text-right font-medium">{t('reports.count')}</th>
                        <th className="px-5 py-3 text-right font-medium">{t('reports.turnover')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {report.by_commercial.map((row) => (
                        <tr key={row.commercial_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{row.commercial}</td>
                          <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.orders)}</td>
                          <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(row.turnover)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DetailSection>

            <DetailSection title={t('reports.byCountry')}>
              {report.by_country.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.by_country.map((row) => (
                    <li
                      key={row.country}
                      onClick={() => row.country !== 'Non renseigné' && setPlaceCountry(row.country)}
                      title={t('reports.clickToFilter')}
                      className={`flex cursor-pointer items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 ${placeCountry === row.country ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
                    >
                      <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <Rocket className="h-4 w-4 text-gray-400" />
                        {row.country}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{formatNumber(row.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>

            <DetailSection title={t('reports.byCity')}>
              {report.by_city.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('reports.noRankingData')}</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.by_city.map((row) => (
                    <li
                      key={row.city}
                      onClick={() => row.city !== 'Non renseigné' && setPlaceCity(row.city)}
                      title={t('reports.clickToFilter')}
                      className={`flex cursor-pointer items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 ${placeCity === row.city ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
                    >
                      <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                        {row.city}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">{formatNumber(row.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DetailSection>
          </div>

          {report.top_clients.length > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <Trophy className="h-4 w-4 shrink-0" />
              {t('reports.topClientsHint')}
            </div>
          )}
        </>
      )}
    </div>
  );
}