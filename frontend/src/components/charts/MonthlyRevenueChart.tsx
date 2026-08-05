import { useTranslation } from 'react-i18next';
import type { MonthlyRevenuePoint } from '@/types/stats';
import { currentLocale } from '@/i18n';

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat(currentLocale()).format(value)} FCFA`;
}

export function MonthlyRevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.revenue));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {t('dashboard.monthlyRevenue')}
      </h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
      ) : (
        <div className="flex h-48 items-end gap-2">
          {data.map((d) => (
            <div key={d.month} className="group flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-gray-400 opacity-0 transition group-hover:opacity-100">
                {formatCurrency(d.revenue)}
              </span>
              <div
                className="w-full rounded-t-md bg-brand-500/80 transition group-hover:bg-brand-500 dark:bg-brand-500/40"
                style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
              />
              <span className="truncate text-[10px] text-gray-400">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
