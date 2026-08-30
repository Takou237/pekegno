import { useEffect, useState } from 'react';
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

export default function DailyBilanPage({ fixedAgencyId }: DailyBilanPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { agencyId: routeAgencyId, countryId: routeCountryId } = useParams<{ agencyId?: string; countryId?: string }>();

  const lockedAgency = fixedAgencyId ?? routeAgencyId ?? null;

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

  useEffect(() => {
    agenciesApi.list({ country_id: routeCountryId, per_page: 200 }).then((r) => setAgencies(r.data)).catch(() => {});
  }, [routeCountryId]);

  useEffect(() => {
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
  }, [date, agencyId, routeCountryId, t]);

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('bilans.title')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('bilans.subtitle')}</p>
          </div>
        </div>
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('bilans.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('bilans.subtitle')}</p>
        </div>
        {canExportData(user) && (
          <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" />
            {t('bilans.export')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-end">
        <div className="sm:w-48">
          <Input label={t('bilans.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
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
    </div>
  );
}

function AgencyBilanCard({ bilan, t }: { bilan: BilanAgency; t: (key: string) => string }) {
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
                  <td className="px-5 py-3 text-right font-medium text-red-600 dark:text-red-400">{formatCurrency(e.total)}</td>
                </tr>
              ))}
              {bilan.expense_total > 0 && (
                <tr className="bg-red-50/50 font-semibold dark:bg-red-500/5">
                  <td colSpan={2} className="px-5 py-3 text-red-600 dark:text-red-400">{t('bilans.expenseTotal')}</td>
                  <td />
                  <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(bilan.expense_total)}</td>
                </tr>
              )}

              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold dark:border-gray-700 dark:bg-gray-800/50">
                <td colSpan={2} className="px-5 py-3 text-gray-900 dark:text-white">{t('bilans.soldeFinal')}</td>
                <td />
                <td className={`px-5 py-3 text-right font-bold ${bilan.solde_final >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(Math.abs(bilan.solde_final))}</td>
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
                <th className="px-5 py-3 text-right font-medium">{t('bilans.serviceTotal')}</th>
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
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.total_ventes_amount)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.cash_total)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.om_total)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(ab.momo_total)}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(ab.total_received)}</td>
                  <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(Math.abs(ab.solde_initial))}</td>
                  <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(ab.expense_total)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(Math.abs(ab.solde_final))}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{t('bilans.totalGeneral')}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_ventes_amount)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_cash)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_om)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_momo)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(totals.total_encaisse)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">—</td>
                <td className="px-5 py-3 text-right text-red-600 dark:text-red-400">{formatCurrency(totals.total_depenses)}</td>
                <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{formatCurrency(Math.abs(totals.total_solde_final))}</td>
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
                <dd className="font-medium text-red-600 dark:text-red-400">{formatCurrency(e.total)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
