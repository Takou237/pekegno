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
import type { DailyBilan } from '@/types/bilan';

interface DailyBilanPageProps {
  fixedAgencyId?: string;
}

export default function DailyBilanPage({ fixedAgencyId }: DailyBilanPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { agencyId: routeAgencyId } = useParams<{ agencyId?: string }>();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [agencyId, setAgencyId] = useState(fixedAgencyId ?? routeAgencyId ?? '');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [bilan, setBilan] = useState<DailyBilan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    agenciesApi
      .list({ per_page: 200 })
      .then((r) => setAgencies(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setBilan(null);

    bilansApi
      .daily({ date, agency_id: agencyId || undefined })
      .then((data) => {
        if (active) setBilan(data);
      })
      .catch((error) => {
        if (active) setLoadError(extractErrorMessage(error, t('bilans.loadFailed')));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, agencyId, t]);

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('bilans');
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
          <Input
            label={t('bilans.date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {!fixedAgencyId && !routeAgencyId && (
          <div className="sm:w-48">
            <Select
              label={t('bilans.agency')}
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
            >
              <option value="">{t('bilans.allAgencies')}</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {loadError}
        </div>
      )}

      {!loadError && !bilan && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('bilans.noData')}</p>
        </div>
      )}

      {bilan && (
        <>
          <div className="flex items-center gap-2">
            {bilan.agency && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                {bilan.agency.name}
              </span>
            )}
            <span className="text-sm text-gray-400">
              {new Date(bilan.date).toLocaleDateString()}
            </span>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('bilans.serviceLabel')}</th>
                    <th className="px-5 py-3 text-right font-medium">{t('bilans.serviceCount')}</th>
                    <th className="px-5 py-3 text-right font-medium">{t('bilans.serviceTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {bilan.services.map((line) => (
                    <tr key={line.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                        {line.label}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                        {line.count}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(line.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{t('bilans.totalServicesSold')}</td>
                    <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">{bilan.total_services_sold}</td>
                    <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">
                      {formatCurrency(bilan.services.reduce((s, l) => s + Number(l.total), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
