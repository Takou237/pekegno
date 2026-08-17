import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, Wallet, HandCoins, Receipt, Award, Trophy, Users, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { reportsApi } from '@/api/reports.api';
import { agenciesApi } from '@/api/agencies.api';
import { commercialsApi } from '@/api/commercials.api';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency, formatNumber } from '@/utils/number';
import { currentLocale } from '@/i18n';
import { canExportData } from '@/utils/exportPermissions';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { SkeletonTable } from '@/components/ui/Skeleton';
import type { CommercialReportResponse, CommercialReportRankingEntry } from '@/api/reports.api';
import type { Agency } from '@/types/agency';

export default function CommercialReportPage({ fixedAgencyId }: { fixedAgencyId?: string } = {}) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [report, setReport] = useState<CommercialReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyFilter, setAgencyFilter] = useState(fixedAgencyId ?? '');
  const [commercialFilter, setCommercialFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    agenciesApi.list({ per_page: 200 }).then((res) => {
      setAgencies(res.data);
    }).catch(() => {});
  }, []);

  const fetchCommercialOptions = useCallback(async (query: string): Promise<AutocompleteOption[]> => {
    const results = await commercialsApi.search(query);
    return results.map((c) => ({
      id: c.id,
      label: [c.first_name, c.last_name].filter(Boolean).join(' '),
      subtitle: c.agency?.name ?? '',
    }));
  }, []);

  const params = useMemo(
    () => ({
      agency_id: agencyFilter || undefined,
      commercial_id: commercialFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [agencyFilter, commercialFilter, fromDate, toDate],
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    reportsApi
      .commercialReport(params)
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

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('commercial-report');
    } catch (error) {
      showToast(t('common.exportFailed'), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  function rankBadge(index: number) {
    if (index === 0) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {index + 1}
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {index + 1}
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
          {index + 1}
        </span>
      );
    }
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {index + 1}
      </span>
    );
  }

  const totals = report?.totals;
  const ranking = report?.ranking ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('reports.commercialTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('reports.commercialSubtitle')}
          </p>
        </div>
        {canExportData(currentUser) && (
          <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" />
            {t('reports.export')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        {!fixedAgencyId && (
        <div className="w-full sm:w-56">
          <Select
            label={t('reports.agency')}
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
          >
            <option value="">{t('reports.allAgencies')}</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        )}
        <div className="w-full sm:w-64">
          <Autocomplete
            label={t('reports.commercial')}
            placeholder={t('reports.searchCommercial')}
            value={commercialFilter}
            onChange={setCommercialFilter}
            fetchOptions={fetchCommercialOptions}
          />
        </div>
        <div className="w-full sm:w-44">
          <Input
            label={t('reports.from')}
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <Input
            label={t('reports.to')}
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
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
              {t('reports.period')}: {new Date(report.period.from).toLocaleDateString(currentLocale())} → {new Date(report.period.to).toLocaleDateString(currentLocale())}
            </p>
          )}

          {totals && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(totals.sales_count)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.salesCount')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(totals.revenue_billed)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.revenueBilled')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(totals.revenue_received)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.revenueReceived')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(totals.payments_count)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.paymentsCount')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(totals.commissions)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.commissions')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(totals.points)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.points')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(totals.prospects_count)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.prospectsCount')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatNumber(totals.clients_converted)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('reports.clientsConverted')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {t('reports.ranking')}
              </h2>
            </div>
            {ranking.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('reports.noRankingData')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-5 py-3 font-medium">{t('reports.rank')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.name')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.agency')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.sales')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.revenueBilled')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.revenueReceived')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.commissions')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.points')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.prospects')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.conversions')}</th>
                      <th className="px-5 py-3 font-medium">{t('reports.conversionRate')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ranking.map((entry: CommercialReportRankingEntry, index: number) => (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3">{rankBadge(index)}</td>
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                          {[entry.first_name, entry.last_name].filter(Boolean).join(' ')}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {entry.agency_name ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {formatNumber(entry.sales_count)}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {formatCurrency(entry.revenue_billed)}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {formatCurrency(entry.revenue_received)}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {formatCurrency(entry.commissions)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-100">
                            <Award className="h-3.5 w-3.5 text-amber-500" />
                            {formatNumber(entry.points)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {formatNumber(entry.prospects_count)}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {formatNumber(entry.clients_converted)}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                          {`${Number(entry.conversion_rate).toFixed(1)}%`}
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
