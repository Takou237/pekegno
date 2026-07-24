import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  lastPage,
  total,
  perPage,
  onPageChange,
}: PaginationProps) {
  if (lastPage <= 1) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {total} résultat{total > 1 ? 's' : ''}
      </p>
    );
  }

  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {from}–{to} sur {total} résultats
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Page {currentPage} / {lastPage}
        </span>
        <button
          type="button"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
