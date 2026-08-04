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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('categories.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('categories.deletedAt')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700"
                          style={{ backgroundColor: category.color ?? '#CBD5E1' }}
                        >
                          <CategoryIcon name={category.icon} className="h-4 w-4 text-white" />
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {category.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {category.deleted_at
                        ? new Date(category.deleted_at).toLocaleDateString(currentLocale())
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
