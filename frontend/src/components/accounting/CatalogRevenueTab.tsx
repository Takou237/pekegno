import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountingApi } from '@/api/accounting.api';
import { extractErrorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { PeriodPresets } from '@/components/ui/PeriodPresets';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/number';
import { paymentMethodLabel } from '@/utils/paymentMethods';
import { presetPeriod } from '@/utils/period';
import { PAYMENT_MODES, type CatalogRevenueReport, type CatalogRevenueRow } from '@/types/accounting';

const KIND_VARIANT: Record<CatalogRevenueRow['kind'], 'brand' | 'success' | 'warning' | 'neutral'> = {
  product: 'brand',
  course: 'success',
  package: 'warning',
  service: 'neutral',
  other: 'neutral',
};

/**
 * Comptabilité par élément du catalogue : chaque produit, formation, package
 * et prestation, avec ce qui a été vendu et encaissé, ventilé par moyen de
 * paiement. La liste suit le catalogue (un nouvel élément y apparaît aussitôt).
 */
export function CatalogRevenueTab({ agencyId }: { agencyId?: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(() => presetPeriod('thisMonth'));
  const [kind, setKind] = useState<'' | CatalogRevenueRow['kind']>('');
  const [search, setSearch] = useState('');
  const [onlySold, setOnlySold] = useState(false);
  const [report, setReport] = useState<CatalogRevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    accountingApi
      .catalogRevenue({ from: period.from || undefined, to: period.to || undefined, agency_id: agencyId || undefined })
      .then((data) => { if (active) setReport(data); })
      .catch((e) => { if (active) setError(extractErrorMessage(e, t('catalogRevenue.loadFailed'))); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period.from, period.to, agencyId, t]);

  // Seuls les moyens réellement utilisés sur la période ont une colonne.
  const modes = useMemo(
    () => PAYMENT_MODES.filter((m) => (report?.totals.by_mode[m] ?? 0) > 0),
    [report],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (report?.rows ?? []).filter((r) =>
      (!kind || r.kind === kind)
      && (!onlySold || r.quantity > 0 || r.collected > 0)
      && (!q || r.name.toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q)),
    );
  }, [report, kind, search, onlySold]);

  const totals = useMemo(() => {
    const byMode = Object.fromEntries(PAYMENT_MODES.map((m) => [m, rows.reduce((s, r) => s + r.by_mode[m], 0)]));
    return {
      quantity: rows.reduce((s, r) => s + r.quantity, 0),
      billed: rows.reduce((s, r) => s + r.billed, 0),
      collected: rows.reduce((s, r) => s + r.collected, 0),
      byMode,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label={t('catalogRevenue.from')} type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
          <Input label={t('catalogRevenue.to')} type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
          <Select label={t('catalogRevenue.kind')} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="">{t('catalogRevenue.allKinds')}</option>
            {(['product', 'course', 'package', 'service'] as const).map((k) => (
              <option key={k} value={k}>{t(`catalogRevenue.kinds_${k}`)}</option>
            ))}
          </Select>
          <Input label={t('catalogRevenue.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <PeriodPresets from={period.from} to={period.to} onChange={setPeriod} />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={onlySold} onChange={(e) => setOnlySold(e.target.checked)} />
            {t('catalogRevenue.onlySold')}
          </label>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && report && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs text-gray-500">{t('catalogRevenue.collected')}</p>
            <p className="mt-1 text-lg font-semibold text-success-600">{formatCurrency(totals.collected)}</p>
          </div>
          {modes.map((m) => (
            <div key={m} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-500">{paymentMethodLabel(m, t)}</p>
              <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(totals.byMode[m])}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="p-5"><SkeletonTable rows={6} /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">{t('catalogRevenue.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('catalogRevenue.item')}</th>
                  <th className="px-4 py-3 font-medium">{t('catalogRevenue.kind')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('catalogRevenue.quantity')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('catalogRevenue.billed')}</th>
                  {modes.map((m) => (
                    <th key={m} className="px-4 py-3 text-right font-medium">{paymentMethodLabel(m, t)}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">{t('catalogRevenue.collected')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r) => (
                  <tr key={r.key} className={r.quantity === 0 && r.collected === 0 ? 'text-gray-400' : ''}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{r.name}</p>
                      {r.category && <p className="text-xs text-gray-400">{r.category}</p>}
                    </td>
                    <td className="px-4 py-2.5"><Badge variant={KIND_VARIANT[r.kind]}>{t(`catalogRevenue.kinds_${r.kind}`)}</Badge></td>
                    <td className="px-4 py-2.5 text-right">{r.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(r.billed)}</td>
                    {modes.map((m) => (
                      <td key={m} className="px-4 py-2.5 text-right">{r.by_mode[m] > 0 ? formatCurrency(r.by_mode[m]) : '—'}</td>
                    ))}
                    <td className="px-4 py-2.5 text-right font-semibold text-success-600">{formatCurrency(r.collected)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>{t('catalogRevenue.total')}</td>
                  <td className="px-4 py-3 text-right">{totals.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.billed)}</td>
                  {modes.map((m) => (
                    <td key={m} className="px-4 py-3 text-right">{formatCurrency(totals.byMode[m])}</td>
                  ))}
                  <td className="px-4 py-3 text-right text-success-600">{formatCurrency(totals.collected)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
