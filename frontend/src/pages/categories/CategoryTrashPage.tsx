import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { categoriesApi } from '@/api/categories.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Category } from '@/types/category';
import type { PaginationMeta } from '@/types/agency';

export default function CategoryTrashPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<Category | null>(null);
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const fetchTrash = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await categoriesApi.trash({ page, per_page: 15 });
      setCategories(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('categories.trashLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(category: Category) {
    try {
      await categoriesApi.restore(category.id);
      showToast(t('categories.restored', { name: category.name }), 'success');
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('categories.restoreFailed')), 'error');
    }
  }

  async function handleForceDelete() {
    if (!forceDeleteTarget) return;
    setIsForceDeleting(true);
    try {
      await categoriesApi.forceDelete(forceDeleteTarget.id);
      showToast(t('categories.forceDeleted'), 'success');
      setCategories((prev) => prev.filter((item) => item.id !== forceDeleteTarget.id));
      setForceDeleteTarget(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('categories.forceDeleteFailed')), 'error');
    } finally {
      setIsForceDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/catalog/categories"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('categories.backToCategories')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('categories.trashTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('categories.trashSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.trashEmpty')}</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: category.color ?? '#CBD5E1' }}
                  >
                    <CategoryIcon name={category.icon} className="h-6 w-6 text-white" />
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleRestore(category)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-success-600 dark:hover:bg-gray-800"
                      title={t('common.restore')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceDeleteTarget(category)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title={t('common.deletePermanently')}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 font-semibold text-gray-900 dark:text-white">{category.name}</p>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-500 dark:text-gray-400">
                  {category.description ?? '—'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('categories.deletedAt')}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {category.deleted_at
                      ? new Date(category.deleted_at).toLocaleDateString(currentLocale())
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(forceDeleteTarget)}
        title={t('categories.forceDeleteTitle')}
        message={t('categories.forceDeleteMessage', { name: forceDeleteTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        isLoading={isForceDeleting}
        onConfirm={handleForceDelete}
        onCancel={() => setForceDeleteTarget(null)}
      />
    </div>
  );
}
