import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, RefreshCw, BarChart3 } from 'lucide-react';
import { reportsApi, type CommercialMonthlyResponse } from '@/api/reports.api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatNumber } from '@/utils/number';
import { presetPeriod } from '@/utils/period';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PeriodPresets } from '@/components/ui/PeriodPresets';
import {
  CommercialMonthlyReportSheet,
  CommercialMonthlyReportPrintPortal,
} from '@/components/reports/CommercialMonthlyReportSheet';

type Scope = 'academy' | 'agency';

export default function CommercialMonthlyReportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCommercial = user?.role?.name === 'commercial';

  const initialPeriod = useMemo(() => presetPeriod('thisMonth'), []);
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [scope, setScope] = useState<Scope>('academy');
  const [commercialFilter, setCommercialFilter] = useState('');
  const [data, setData] = useState<CommercialMonthlyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOptions = useCallback(async (query: string): Promise<AutocompleteOption[]> => {
    const results = await reportsApi.commercialOptions(query);
    return results.map((user) => ({
      id: user.user_id,
      label: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.user_id,
      subtitle: [user.role, user.agency?.name].filter(Boolean).join(' · '),
    }));
  }, []);

  const load = useCallback(() => {
    if (!isCommercial && !commercialFilter) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError('');
    reportsApi
      .commercialMonthly({
        commercial_id: isCommercial ? undefined : commercialFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((res) => setData(res))
      .catch(() => {
        setData(null);
        setError(t('reports.monthly.loadError'));
      })
      .finally(() => setIsLoading(false));
  }, [isCommercial, commercialFilter, from, to, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-500" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('reports.monthly.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!data}>
            <Printer className="h-4 w-4" />
            {t('reports.monthly.print')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!isCommercial && (
            <Autocomplete
              label={t('reports.monthly.commercial')}
              placeholder={t('reports.monthly.selectCommercial')}
              value={commercialFilter}
              onChange={setCommercialFilter}
              fetchOptions={fetchOptions}
            />
          )}
          <Input label={t('reports.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t('reports.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <PeriodPresets
          from={from}
          to={to}
          onChange={(p) => {
            setFrom(p.from);
            setTo(p.to);
          }}
          only={['thisMonth', 'lastMonth', 'last30Days', 'thisYear']}
        />
      </div>

      {error && <Alert variant="error" className="print:hidden">{error}</Alert>}

      {!isCommercial && !commercialFilter ? (
        <Alert variant="info" className="print:hidden">{t('reports.monthly.chooseCommercialHint')}</Alert>
      ) : isLoading && !data ? (
        <SkeletonTable rows={8} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
            {[
              { label: t('reports.monthly.kpi.received'), value: formatCurrency(data.totals.received) },
              { label: t('reports.monthly.kpi.billed'), value: formatCurrency(data.totals.billed) },
              { label: t('reports.monthly.kpi.collectionRate'), value: `${formatNumber(data.totals.collection_rate)} %` },
              { label: t('reports.monthly.kpi.balanceDue'), value: formatCurrency(data.totals.balance_due) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 print:hidden">
            {(['academy', 'agency'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  scope === s
                    ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {s === 'academy' ? t('reports.monthly.tabAcademy') : t('reports.monthly.tabAgency')}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 print:hidden">
            <CommercialMonthlyReportSheet data={data} scope={scope} />
          </div>

          <CommercialMonthlyReportPrintPortal data={data} />
        </>
      ) : (
        <Alert variant="info" className="print:hidden">{t('reports.monthly.noData')}</Alert>
      )}
    </div>
  );
}
