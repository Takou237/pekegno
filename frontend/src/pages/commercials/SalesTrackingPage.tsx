import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Printer, RefreshCw, RotateCcw, TrendingUp } from 'lucide-react';
import {
  reportsApi,
  type SalesTrackingLine,
  type SalesTrackingResponse,
  type SalesTrackingStatus,
  type SalesTrackingTotals,
  type SalesTrackingType,
} from '@/api/reports.api';
import { commercialsApi } from '@/api/commercials.api';
import { agenciesApi } from '@/api/agencies.api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatNumber } from '@/utils/number';
import { formatRelativeDate } from '@/utils/date';
import { presetPeriod } from '@/utils/period';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PeriodPresets } from '@/components/ui/PeriodPresets';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import type { Agency } from '@/types/agency';
import logoUrl from '@/assets/pekegno-logo.png';

const TYPE_LABEL: Record<SalesTrackingType, string> = { academy: 'typeAcademy', agency: 'typeAgency' };

export default function SalesTrackingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCommercial = user?.role?.name === 'commercial';

  const initialPeriod = useMemo(() => presetPeriod('thisMonth'), []);
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [commercialFilter, setCommercialFilter] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [city, setCity] = useState('');
  const [activity, setActivity] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [data, setData] = useState<SalesTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [printPayload, setPrintPayload] = useState<{ lines: SalesTrackingLine[]; totals: SalesTrackingTotals } | null>(null);

  const query = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      commercial_id: isCommercial ? undefined : commercialFilter || undefined,
      agency_id: agencyId || undefined,
      city: city.trim() || undefined,
      activity: activity.trim() || undefined,
      status: (status || undefined) as SalesTrackingStatus | undefined,
      type: (type || undefined) as SalesTrackingType | undefined,
      search: search.trim() || undefined,
    }),
    [from, to, isCommercial, commercialFilter, agencyId, city, activity, status, type, search],
  );

  // Recharge systématiquement en page 1 quand un filtre change.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const fetchOptions = useCallback(async (q: string): Promise<AutocompleteOption[]> => {
    const results = await commercialsApi.search(q);
    return results.map((c) => ({
      id: c.id,
      label: [c.first_name, c.last_name].filter(Boolean).join(' '),
      subtitle: c.agency?.name ?? '',
    }));
  }, []);

  useEffect(() => {
    if (isCommercial) return;
    agenciesApi
      .list({ per_page: 100 })
      .then((res) => setAgencies(res.data))
      .catch(() => setAgencies([]));
  }, [isCommercial]);

  const load = useCallback(() => {
    setIsLoading(true);
    setError('');
    reportsApi
      .salesTracking({ ...query, page, per_page: 20 })
      .then((res) => setData(res))
      .catch(() => {
        setData(null);
        setError(t('reports.salesTracking.loadError'));
      })
      .finally(() => setIsLoading(false));
  }, [query, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = useCallback(async () => {
    try {
      const res = await reportsApi.salesTracking({ ...query, page: 1, per_page: 100 });
      setPrintPayload({ lines: res.data, totals: res.totals });
    } catch {
      if (data) setPrintPayload({ lines: data.data, totals: data.totals });
    }
  }, [query, data]);

  useEffect(() => {
    if (printPayload) window.print();
  }, [printPayload]);

  const resetFilters = () => {
    setCommercialFilter('');
    setAgencyId('');
    setCity('');
    setActivity('');
    setStatus('');
    setType('');
    setSearch('');
  };

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-500" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('reports.salesTracking.title')}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('reports.salesTracking.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={!data || totals?.lines === 0}>
            <Printer className="h-4 w-4" />
            {t('reports.salesTracking.print')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!isCommercial && (
            <Autocomplete
              label={t('reports.commercial')}
              placeholder={t('reports.searchCommercial')}
              value={commercialFilter}
              onChange={setCommercialFilter}
              fetchOptions={fetchOptions}
            />
          )}
          {!isCommercial && (
            <Select label={t('reports.agency')} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              <option value="">{t('reports.allAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
          <Input label={t('reports.salesTracking.city')} placeholder={t('reports.salesTracking.cityPlaceholder')} value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label={t('reports.salesTracking.activity')} placeholder={t('reports.salesTracking.activityPlaceholder')} value={activity} onChange={(e) => setActivity(e.target.value)} />
          <Select label={t('reports.salesTracking.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('reports.salesTracking.allStatuses')}</option>
            <option value="paid">{t('invoices.statusPaid')}</option>
            <option value="partial">{t('invoices.statusPartial')}</option>
            <option value="unpaid">{t('invoices.statusUnpaid')}</option>
          </Select>
          <Select label={t('reports.salesTracking.type')} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('reports.salesTracking.allTypes')}</option>
            <option value="academy">{t('reports.salesTracking.typeAcademy')}</option>
            <option value="agency">{t('reports.salesTracking.typeAgency')}</option>
          </Select>
          <Input label={t('reports.salesTracking.clientSearch')} placeholder={t('reports.salesTracking.clientSearchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Input label={t('reports.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t('reports.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PeriodPresets
            from={from}
            to={to}
            onChange={(p) => {
              setFrom(p.from);
              setTo(p.to);
            }}
            only={['today', 'thisWeek', 'thisMonth', 'lastMonth', 'last30Days', 'thisYear']}
          />
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" />
            {t('reports.salesTracking.reset')}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="print:hidden">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 print:hidden">
        {[
          { label: t('reports.salesTracking.kpi.lines'), value: formatNumber(totals?.lines ?? 0) },
          { label: t('reports.salesTracking.kpi.billed'), value: formatCurrency(totals?.billed ?? 0) },
          { label: t('reports.salesTracking.kpi.received'), value: formatCurrency(totals?.received ?? 0) },
          { label: t('reports.salesTracking.kpi.balanceDue'), value: formatCurrency(totals?.balance_due ?? 0) },
          { label: t('reports.salesTracking.kpi.collectionRate'), value: `${formatNumber(totals?.collection_rate ?? 0)} %` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {isLoading && !data ? (
        <SkeletonTable rows={8} />
      ) : data && data.data.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 print:hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.date')}</th>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.invoice')}</th>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.client')}</th>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.city')}</th>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.activity')}</th>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.type')}</th>
                  <th className="px-4 py-3 text-right">{t('reports.salesTracking.columns.quantity')}</th>
                  <th className="px-4 py-3 text-right">{t('reports.salesTracking.columns.billed')}</th>
                  <th className="px-4 py-3 text-right">{t('reports.salesTracking.columns.paid')}</th>
                  <th className="px-4 py-3 text-right">{t('reports.salesTracking.columns.balance')}</th>
                  <th className="px-4 py-3">{t('reports.salesTracking.columns.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                      {row.invoice_date ? formatRelativeDate(row.invoice_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.invoice_number ? (
                        <Link to={`/invoices/${row.invoice_id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
                          {row.invoice_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{row.client}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.city}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{row.activity}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.type === 'agency' ? 'brand' : 'neutral'}>
                        {t(`reports.salesTracking.${TYPE_LABEL[row.type]}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatNumber(row.quantity)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-gray-800 dark:text-gray-200">{formatCurrency(row.billed)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-gray-800 dark:text-gray-200">{formatCurrency(row.paid)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(row.balance)}</td>
                    <td className="px-4 py-3">{<InvoiceStatusBadge status={row.status} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="print:hidden">
            <Pagination
              currentPage={data.meta.current_page}
              lastPage={data.meta.last_page}
              total={data.meta.total}
              perPage={data.meta.per_page}
              onPageChange={setPage}
            />
          </div>
        </>
      ) : (
        !isLoading && <Alert variant="info" className="print:hidden">{t('reports.salesTracking.noData')}</Alert>
      )}

      {printPayload && <SalesTrackingPrintPortal lines={printPayload.lines} totals={printPayload.totals} t={t} />}
    </div>
  );
}

function SalesTrackingPrintPortal({
  lines,
  totals,
  t,
}: {
  lines: SalesTrackingLine[];
  totals: SalesTrackingTotals;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const th = 'border border-gray-300 px-2 py-1 text-left font-semibold';
  const td = 'border border-gray-300 px-2 py-1';
  const tdRight = `${td} text-right whitespace-nowrap`;

  return createPortal(
    <div id="sales-tracking-print">
      <div className="bg-white px-8 py-7 text-[11px] leading-snug text-gray-900" style={{ fontFamily: 'Verdana, Arial, sans-serif' }}>
        <header className="mb-4 flex items-start justify-between gap-4 border-b-2 border-brand-500 pb-3">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="PEKEGNO" className="h-12 w-auto" />
            <div>
              <p className="text-lg font-bold text-gray-900">PEKEGNO</p>
              <p className="text-xs text-gray-500">{t('reports.salesTracking.subtitle')}</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-700">
            <p className="text-sm font-bold text-gray-900">{t('reports.salesTracking.title')}</p>
            <p className="mt-1">{t('reports.salesTracking.columns.date')} : {new Date().toLocaleDateString()}</p>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-5 gap-2">
          {[
            { label: t('reports.salesTracking.kpi.lines'), value: formatNumber(totals.lines) },
            { label: t('reports.salesTracking.kpi.billed'), value: formatCurrency(totals.billed) },
            { label: t('reports.salesTracking.kpi.received'), value: formatCurrency(totals.received) },
            { label: t('reports.salesTracking.kpi.balanceDue'), value: formatCurrency(totals.balance_due) },
            { label: t('reports.salesTracking.kpi.collectionRate'), value: `${formatNumber(totals.collection_rate)} %` },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-gray-300 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-wide text-gray-500">{k.label}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-100">
              <th className={th}>{t('reports.salesTracking.columns.date')}</th>
              <th className={th}>{t('reports.salesTracking.columns.invoice')}</th>
              <th className={th}>{t('reports.salesTracking.columns.client')}</th>
              <th className={th}>{t('reports.salesTracking.columns.city')}</th>
              <th className={th}>{t('reports.salesTracking.columns.activity')}</th>
              <th className={th}>{t('reports.salesTracking.columns.type')}</th>
              <th className={`${th} text-right`}>{t('reports.salesTracking.columns.quantity')}</th>
              <th className={`${th} text-right`}>{t('reports.salesTracking.columns.billed')}</th>
              <th className={`${th} text-right`}>{t('reports.salesTracking.columns.paid')}</th>
              <th className={`${th} text-right`}>{t('reports.salesTracking.columns.balance')}</th>
              <th className={th}>{t('reports.salesTracking.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((r) => (
              <tr key={r.id}>
                <td className={td}>{r.invoice_date ?? '—'}</td>
                <td className={td}>{r.invoice_number ?? '—'}</td>
                <td className={td}>{r.client}</td>
                <td className={td}>{r.city}</td>
                <td className={td}>{r.activity}</td>
                <td className={td}>{t(`reports.salesTracking.${TYPE_LABEL[r.type]}`)}</td>
                <td className={tdRight}>{formatNumber(r.quantity)}</td>
                <td className={tdRight}>{formatCurrency(r.billed)}</td>
                <td className={tdRight}>{formatCurrency(r.paid)}</td>
                <td className={tdRight}>{formatCurrency(r.balance)}</td>
                <td className={td}>{t(`invoices.status${r.status.charAt(0).toUpperCase()}${r.status.slice(1)}`)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className={td} colSpan={6}>{t('reports.salesTracking.total')}</td>
              <td className={tdRight}>{formatNumber(totals.lines)}</td>
              <td className={tdRight}>{formatCurrency(totals.billed)}</td>
              <td className={tdRight}>{formatCurrency(totals.received)}</td>
              <td className={tdRight}>{formatCurrency(totals.balance_due)}</td>
              <td className={td} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>,
    document.body,
  );
}
