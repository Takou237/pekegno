import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { bilansApi } from '@/api/bilans.api';
import { agenciesApi } from '@/api/agencies.api';
import { downloadExport } from '@/api/exports.api';
import { extractErrorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { canExportData } from '@/utils/exportPermissions';
import { formatCurrency } from '@/utils/number';
import type { Agency } from '@/types/agency';
import type { BilanAgency } from '@/types/bilan';

interface DailyBilanPageProps {
  fixedAgencyId?: string;
}

type ViewMode = 'day' | 'period';

interface PeriodBlock {
  key: string;
  title: string;
  days: BilanAgency[];
}

function defaultPeriodFrom(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function DailyBilanPage({ fixedAgencyId }: DailyBilanPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { agencyId: routeAgencyId, countryId: routeCountryId } = useParams<{ agencyId?: string; countryId?: string }>();

  const lockedAgency = fixedAgencyId ?? routeAgencyId ?? null;

  const [viewMode, setViewMode] = useState<ViewMode>('period');

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [agencyId, setAgencyId] = useState(lockedAgency ?? '');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyBilan, setAgencyBilan] = useState<BilanAgency | null>(null);
  const [consolidated, setConsolidated] = useState<{
    agencies: BilanAgency[];
    totals: { total_ventes: number; total_ventes_amount: number; total_encaisse: number; total_cash: number; total_om: number; total_momo: number; total_depenses: number; total_solde_final: number };
    expenses_by_category: { name: string; total: number }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [periodFrom, setPeriodFrom] = useState(defaultPeriodFrom());
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodBlocks, setPeriodBlocks] = useState<PeriodBlock[]>([]);
  const [periodLoading, setPeriodLoading] = useState(true);
  const [periodError, setPeriodError] = useState<string | null>(null);

  useEffect(() => {
    agenciesApi.list({ country_id: routeCountryId, per_page: 200 }).then((r) => setAgencies(r.data)).catch(() => {});
  }, [routeCountryId]);

  useEffect(() => {
    if (viewMode !== 'day') return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setAgencyBilan(null);
    setConsolidated(null);

    bilansApi
      .daily({ date, agency_id: agencyId || undefined, country_id: routeCountryId })
      .then((data) => {
        if (!active) return;
        if (data.agencies) {
          setConsolidated({ agencies: data.agencies, totals: data.totals!, expenses_by_category: data.expenses_by_category ?? [] });
        } else {
          setAgencyBilan(data);
        }
      })
      .catch((error) => {
        if (active) setLoadError(extractErrorMessage(error, t('bilans.loadFailed')));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [viewMode, date, agencyId, routeCountryId, t]);

  useEffect(() => {
    if (viewMode !== 'period') return;
    let active = true;
    setPeriodLoading(true);
    setPeriodError(null);

    async function load() {
      try {
        if (agencyId) {
          const res = await bilansApi.period({ from: periodFrom, to: periodTo, agency_id: agencyId });
          if (!active) return;
          setPeriodBlocks([{ key: agencyId, title: res.agency?.name ?? t('bilans.agency'), days: res.days }]);
        } else if (agencies.length > 1) {
          const [globalRes, ...agencyResList] = await Promise.all([
            bilansApi.period({ from: periodFrom, to: periodTo, country_id: routeCountryId }),
            ...agencies.map((a) => bilansApi.period({ from: periodFrom, to: periodTo, agency_id: a.id })),
          ]);
          if (!active) return;
          setPeriodBlocks([
            { key: 'global', title: t('bilans.globalView'), days: globalRes.days },
            ...agencies.map((a, i) => ({ key: a.id, title: a.name, days: agencyResList[i].days })),
          ]);
        } else if (agencies.length === 1) {
          const res = await bilansApi.period({ from: periodFrom, to: periodTo, agency_id: agencies[0].id });
          if (!active) return;
          setPeriodBlocks([{ key: agencies[0].id, title: agencies[0].name, days: res.days }]);
        } else {
          setPeriodBlocks([]);
        }
      } catch (error) {
        if (active) setPeriodError(extractErrorMessage(error, t('bilans.loadFailed')));
      } finally {
        if (active) setPeriodLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [viewMode, periodFrom, periodTo, agencyId, agencies, routeCountryId, t]);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('bilans', { date, agency_id: agencyId || undefined, country_id: routeCountryId });
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportPeriod() {
    if (periodBlocks.length === 0) return;
    const csv = buildPeriodCsv(periodBlocks, t);
    downloadCsv(`bilan-periode-${periodFrom}-au-${periodTo}.csv`, csv);
  }

  const modeTabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('bilans.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('bilans.subtitle')}</p>
        </div>
        {viewMode === 'day' ? (
          canExportData(user) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('bilans.export')}
            </Button>
          )
        ) : (
          canExportData(user) && (
            <Button variant="outline" onClick={handleExportPeriod} disabled={periodBlocks.length === 0}>
              <Download className="h-4 w-4" />
              {t('bilans.exportPeriod')}
            </Button>
          )
        )}
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button type="button" className={modeTabClass(viewMode === 'period')} onClick={() => setViewMode('period')}>
          {t('bilans.viewPeriod')}
        </button>
        <button type="button" className={modeTabClass(viewMode === 'day')} onClick={() => setViewMode('day')}>
          {t('bilans.viewDay')}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-end">
        {viewMode === 'day' ? (
          <div className="sm:w-48">
            <Input label={t('bilans.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="sm:w-48">
              <Input label={t('invoices.filterFrom')} type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </div>
            <div className="sm:w-48">
              <Input label={t('invoices.filterTo')} type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
          </>
        )}
        {!lockedAgency && (
          <div className="sm:w-48">
            <Select label={t('bilans.agency')} value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
              <option value="">{t('bilans.allAgencies')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {viewMode === 'day' ? (
        isLoading ? (
          <SkeletonTable rows={4} />
        ) : (
          <>
            {loadError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{loadError}</div>
            )}
            {!loadError && !agencyBilan && !consolidated && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('bilans.noData')}</p>
              </div>
            )}
            {agencyBilan && <AgencyBilanCard bilan={agencyBilan} t={t} />}
            {consolidated && <ConsolidatedView consolidated={consolidated} t={t} />}
          </>
        )
      ) : periodLoading ? (
        <SkeletonTable rows={6} />
      ) : (
        <>
          {periodError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{periodError}</div>
          )}
          {!periodError && periodBlocks.every((b) => b.days.length === 0) && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('bilans.noPeriodData')}</p>
            </div>
          )}
          {periodBlocks.map((block) => (
            <PeriodTable key={block.key} title={block.title} days={block.days} t={t} />
          ))}
        </>
      )}
    </div>
  );
}

export function formatSignedCurrency(value: number | string): string {
  const n = Number(value);
  const prefix = n < 0 ? '−' : '';
  return `${prefix}${formatCurrency(Math.abs(n))}`;
}

export function AgencyBilanCard({ bilan, t }: { bilan: BilanAgency; t: (key: string) => string }) {
  return (
    <>
      <div className="flex items-center gap-2">
        {bilan.agency && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            {bilan.agency.name}
          </span>
        )}
        <span className="text-sm text-gray-400">{new Date(bilan.date).toLocaleDateString()}</span>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('bilans.category')}</th>
                <th className="px-5 py-3 font-medium">{t('bilans.serviceLabel')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.serviceCount')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.serviceTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {bilan.services_by_category.map((line, idx) => (
                <tr key={`${line.label}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{line.category}</td>
                  <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{line.label}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{line.count}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(line.total)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                <td colSpan={2} className="px-5 py-3 text-gray-800 dark:text-gray-100">{t('bilans.totalVentes')}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{bilan.total_ventes}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(bilan.services_by_category.reduce((s, l) => s + l.total, 0))}</td>
              </tr>

              <tr className="border-t-2 border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
                <td colSpan={2} className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{t('bilans.cashTotal')}</td>
                <td />
                <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(bilan.cash_total)}</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td colSpan={2} className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{t('bilans.omTotal')}</td>
                <td />
                <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(bilan.om_total)}</td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td colSpan={2} className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{t('bilans.momoTotal')}</td>
                <td />
                <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(bilan.momo_total)}</td>
              </tr>
              <tr className="bg-brand-50/50 font-semibold dark:bg-brand-500/5">
                <td colSpan={2} className="px-5 py-3 text-brand-700 dark:text-brand-300">{t('bilans.totalReceived')}</td>
                <td />
                <td className="px-5 py-3 text-right text-brand-700 dark:text-brand-300">{formatCurrency(bilan.total_received)}</td>
              </tr>

              <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                <td colSpan={2} className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{t('bilans.soldeInitial')}</td>
                <td />
                <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(Math.abs(bilan.solde_initial))}</td>
              </tr>

              {bilan.expenses_by_category.map((e) => (
                <tr key={e.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td colSpan={2} className="px-5 py-3 text-red-600 dark:text-red-400">{e.name}</td>
                  <td />
                  <td className="px-5 py-3 text-right font-medium text-red-600 dark:text-red-400">{formatSignedCurrency(-Math.abs(e.total))}</td>
                </tr>
              ))}
              {bilan.expense_total > 0 && (
                <tr className="bg-red-50/50 font-semibold dark:bg-red-500/5">
                  <td colSpan={2} className="px-5 py-3 text-red-600 dark:text-red-400">{t('bilans.expenseTotal')}</td>
                  <td />
                  <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{formatSignedCurrency(-Math.abs(bilan.expense_total))}</td>
                </tr>
              )}

              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold dark:border-gray-700 dark:bg-gray-800/50">
                <td colSpan={2} className="px-5 py-3 text-gray-900 dark:text-white">{t('bilans.soldeFinal')}</td>
                <td />
                <td className={`px-5 py-3 text-right font-bold ${bilan.solde_final >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>{formatSignedCurrency(bilan.solde_final)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ConsolidatedView({ consolidated, t }: {
  consolidated: {
    agencies: BilanAgency[];
    totals: { total_ventes: number; total_ventes_amount: number; total_encaisse: number; total_cash: number; total_om: number; total_momo: number; total_depenses: number; total_solde_final: number };
    expenses_by_category: { name: string; total: number }[];
  };
  t: (key: string) => string;
}) {
  const { agencies, totals, expenses_by_category } = consolidated;

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('bilans.agency')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.cashTotal')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.omTotal')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.momoTotal')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.totalReceived')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.soldeInitial')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.expenseTotal')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('bilans.soldeFinal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {agencies.map((ab) => (
                <tr key={ab.agency_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{ab.agency?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.cash_total)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.om_total)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.momo_total)}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(ab.total_received)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.solde_initial)}</td>
                  <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{formatSignedCurrency(-Math.abs(ab.expense_total))}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">{formatSignedCurrency(ab.solde_final)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{t('bilans.totalGeneral')}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_cash)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_om)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_momo)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_encaisse)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">—</td>
                <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{formatSignedCurrency(-Math.abs(totals.total_depenses))}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatSignedCurrency(totals.total_solde_final)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {expenses_by_category.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">{t('bilans.expensesGlobalDetail')}</h3>
          <dl className="space-y-2 text-sm">
            {expenses_by_category.map((e) => (
              <div key={e.name} className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{e.name}</dt>
                <dd className="font-medium text-red-600 dark:text-red-400">{formatSignedCurrency(-Math.abs(e.total))}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}

function buildCategoryColumns(days: BilanAgency[]): string[] {
  const set = new Set<string>();
  for (const d of days) {
    for (const s of d.services_by_category) set.add(s.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
}

function buildExpenseColumns(days: BilanAgency[]): string[] {
  const set = new Set<string>();
  for (const d of days) {
    for (const e of d.expenses_by_category) set.add(e.name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
}

function categoryTotal(day: BilanAgency, category: string): number {
  return day.services_by_category.filter((s) => s.category === category).reduce((sum, s) => sum + s.total, 0);
}

function expenseCategoryTotal(day: BilanAgency, name: string): number {
  return day.expenses_by_category.filter((e) => e.name === name).reduce((sum, e) => sum + e.total, 0);
}

// Reproduit la mise en page « Bilan Jour » du classeur Excel de référence :
// un jour par ligne, une colonne par catégorie de vente puis Cash/OM/MOMO/
// Solde initial, une colonne par catégorie de dépense, Total dépenses et
// Solde final — répété par agence quand plusieurs sont affichées.
function PeriodTable({ title, days, t }: { title: string; days: BilanAgency[]; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const saleCols = useMemo(() => buildCategoryColumns(days), [days]);
  const expenseCols = useMemo(() => buildExpenseColumns(days), [days]);

  if (days.length === 0) return null;

  const sum = (fn: (d: BilanAgency) => number) => days.reduce((s, d) => s + fn(d), 0);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <h3 className="px-5 pt-5 text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
            <tr>
              <th className="sticky left-0 z-10 bg-white px-4 py-3 font-medium dark:bg-gray-900">{t('bilans.date')}</th>
              {saleCols.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-3 text-right font-medium">{c}</th>
              ))}
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.totalVentesCol')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.cashTotal')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.omTotal')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.momoTotal')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.totalEncaisseCol')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.soldeInitial')}</th>
              {expenseCols.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-3 text-right font-medium text-red-500 dark:text-red-400">{c}</th>
              ))}
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-red-500 dark:text-red-400">{t('bilans.totalDepensesCol')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">{t('bilans.soldeFinal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {days.map((d) => (
              <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  {new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                </td>
                {saleCols.map((c) => {
                  const v = categoryTotal(d, c);
                  return (
                    <td key={c} className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {v > 0 ? formatCurrency(v) : '—'}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(d.total_ventes_amount)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatCurrency(d.cash_total)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatCurrency(d.om_total)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatCurrency(d.momo_total)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-brand-700 dark:text-brand-300">{formatCurrency(d.total_received)}</td>
                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">{formatSignedCurrency(d.solde_initial)}</td>
                {expenseCols.map((c) => {
                  const v = expenseCategoryTotal(d, c);
                  return (
                    <td key={c} className="px-4 py-2.5 text-right text-red-500 dark:text-red-400">
                      {v > 0 ? formatCurrency(v) : '—'}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">{formatCurrency(d.expense_total)}</td>
                <td className={`px-4 py-2.5 text-right font-bold ${d.solde_final >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                  {formatSignedCurrency(d.solde_final)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold dark:border-gray-700 dark:bg-gray-800/50">
              <td className="sticky left-0 z-10 bg-gray-50 px-4 py-3 dark:bg-gray-800/50">{t('bilans.periodTotalRow')}</td>
              {saleCols.map((c) => (
                <td key={c} className="px-4 py-3 text-right">{formatCurrency(sum((d) => categoryTotal(d, c)))}</td>
              ))}
              <td className="px-4 py-3 text-right">{formatCurrency(sum((d) => d.total_ventes_amount))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(sum((d) => d.cash_total))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(sum((d) => d.om_total))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(sum((d) => d.momo_total))}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(sum((d) => d.total_received))}</td>
              <td className="px-4 py-3 text-right">{formatSignedCurrency(sum((d) => d.solde_initial))}</td>
              {expenseCols.map((c) => (
                <td key={c} className="px-4 py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(sum((d) => expenseCategoryTotal(d, c)))}</td>
              ))}
              <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(sum((d) => d.expense_total))}</td>
              <td className="px-4 py-3 text-right">{formatSignedCurrency(sum((d) => d.solde_final))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function csvCell(value: string | number): string {
  const s = typeof value === 'number' ? String(value) : value;
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildPeriodCsv(blocks: PeriodBlock[], t: (key: string) => string): string {
  const allDates = Array.from(new Set(blocks.flatMap((b) => b.days.map((d) => d.date)))).sort();

  const perBlock = blocks.map((block) => ({
    block,
    saleCols: buildCategoryColumns(block.days),
    expenseCols: buildExpenseColumns(block.days),
    byDate: Object.fromEntries(block.days.map((d) => [d.date, d])) as Record<string, BilanAgency>,
  }));

  const header: string[] = [t('bilans.date')];
  for (const { block, saleCols, expenseCols } of perBlock) {
    for (const c of saleCols) header.push(`${block.title} - ${c}`);
    header.push(`${block.title} - ${t('bilans.totalVentesCol')}`);
    header.push(`${block.title} - ${t('bilans.cashTotal')}`);
    header.push(`${block.title} - ${t('bilans.omTotal')}`);
    header.push(`${block.title} - ${t('bilans.momoTotal')}`);
    header.push(`${block.title} - ${t('bilans.totalEncaisseCol')}`);
    header.push(`${block.title} - ${t('bilans.soldeInitial')}`);
    for (const c of expenseCols) header.push(`${block.title} - ${c}`);
    header.push(`${block.title} - ${t('bilans.totalDepensesCol')}`);
    header.push(`${block.title} - ${t('bilans.soldeFinal')}`);
  }

  const rows: (string | number)[][] = [header];

  for (const date of allDates) {
    const row: (string | number)[] = [new Date(date).toLocaleDateString('fr-FR')];
    for (const { saleCols, expenseCols, byDate } of perBlock) {
      const day = byDate[date];
      for (const c of saleCols) row.push(day ? categoryTotal(day, c) : 0);
      row.push(day ? day.total_ventes_amount : 0);
      row.push(day ? day.cash_total : 0);
      row.push(day ? day.om_total : 0);
      row.push(day ? day.momo_total : 0);
      row.push(day ? day.total_received : 0);
      row.push(day ? day.solde_initial : 0);
      for (const c of expenseCols) row.push(day ? expenseCategoryTotal(day, c) : 0);
      row.push(day ? day.expense_total : 0);
      row.push(day ? day.solde_final : 0);
    }
    rows.push(row);
  }

  const totalRow: (string | number)[] = [t('bilans.periodTotalRow')];
  for (const { block, saleCols, expenseCols } of perBlock) {
    for (const c of saleCols) totalRow.push(block.days.reduce((s, d) => s + categoryTotal(d, c), 0));
    totalRow.push(block.days.reduce((s, d) => s + d.total_ventes_amount, 0));
    totalRow.push(block.days.reduce((s, d) => s + d.cash_total, 0));
    totalRow.push(block.days.reduce((s, d) => s + d.om_total, 0));
    totalRow.push(block.days.reduce((s, d) => s + d.momo_total, 0));
    totalRow.push(block.days.reduce((s, d) => s + d.total_received, 0));
    totalRow.push(block.days.reduce((s, d) => s + d.solde_initial, 0));
    for (const c of expenseCols) totalRow.push(block.days.reduce((s, d) => s + expenseCategoryTotal(d, c), 0));
    totalRow.push(block.days.reduce((s, d) => s + d.expense_total, 0));
    totalRow.push(block.days.reduce((s, d) => s + d.solde_final, 0));
  }
  rows.push(totalRow);

  return rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
