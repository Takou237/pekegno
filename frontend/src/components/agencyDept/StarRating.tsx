import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RatingSummary } from '@/types/agencyDepartment';

/** Étoiles (lecture seule, ou interactives si `onChange`). */
export function Stars({ value, size = 'h-4 w-4', onChange }: { value: number | null; size?: string; onChange?: (v: number) => void }) {
  const rounded = Math.round(value ?? 0);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n}`}
        >
          <Star className={`${size} ${n <= rounded ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </button>
      ))}
    </span>
  );
}

/** Bloc façon Play Store : grosse moyenne, étoiles, nombre d'avis, barres 5→1. */
export function RatingSummaryCard({ summary }: { summary: RatingSummary | null | undefined }) {
  const { t } = useTranslation();
  const count = summary?.count ?? 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-col items-center sm:w-32">
        <span className="text-4xl font-semibold text-gray-900 dark:text-white">{summary?.avg != null ? summary.avg.toFixed(1) : '—'}</span>
        <Stars value={summary?.avg ?? 0} />
        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.reviews.count', { count })}</span>
      </div>
      {summary?.has_direct_rating && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700 sm:w-44">
          <span className="block font-semibold">{t('agencyDept.reviews.directFromClient')}</span>
          <span className="mt-1 flex items-center gap-2">
            <Stars value={summary.direct_rating ?? 0} size="h-3.5 w-3.5" />
            {summary.direct_rating}/5
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = Number(summary?.distribution?.[star] ?? 0);
          const pct = count > 0 ? (n / count) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-3 text-right">{star}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 text-right">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
