import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PageEntry = number | 'start-gap' | 'end-gap';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const windowSize = 2;
  const entries: PageEntry[] = [1];

  if (totalPages > 2 * windowSize + 3) {
    const start = Math.max(2, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);
    if (start > 2) entries.push('start-gap');
    for (let i = start; i <= end; i++) entries.push(i);
    if (end < totalPages - 1) entries.push('end-gap');
    entries.push(totalPages);
  } else {
    for (let i = 2; i <= totalPages; i++) entries.push(i);
  }

  const cls = (active: boolean) =>
    `inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

  const disabledCls = 'opacity-40 pointer-events-none';

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        aria-label={t('catalog.prevPage')}
        className={cls(false) + (page <= 1 ? ' ' + disabledCls : '')}
      >
        <ChevronLeft size={18} />
      </button>
      {entries.map((entry) =>
        entry === 'start-gap' || entry === 'end-gap' ? (
          <span key={entry} className="inline-flex min-w-9 h-9 items-center justify-center px-2 text-sm text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            className={cls(entry === page)}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        aria-label={t('catalog.nextPage')}
        className={cls(false) + (page >= totalPages ? ' ' + disabledCls : '')}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}