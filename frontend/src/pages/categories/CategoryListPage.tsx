import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { categoriesApi } from '@/api/categories.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import { CategoryDetailModal } from '@/components/categories/CategoryDetailModal';
import { CategoryIcon } from '@/utils/categoryIcons';
import { canCreateService, canDeleteService, canEditService, canManageCatalogTrash } from '@/utils/catalogPermissions';
import type { Category } from '@/types/category';
import type { PaginationMeta } from '@/types/agency';

export default function CategoryListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [formModalState, setFormModalState] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  });
  const [detailCategory, setDetailCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await categoriesApi.list({
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: 15,
      });
      setCategories(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('categories.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [search, sortBy, sortOrder, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchCategories();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortBy, sortOrder]);

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await categoriesApi.remove(deleteTarget.id);
      showToast(t('categories.archived'), 'success');
      setDeleteTarget(null);
      fetchCategories();
    } catch (error) {
      showToast(extractErrorMessage(error, t('categories.deleteFailed')), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSaved(saved: Category) {
    setCategories((prev) => {
      const exists = prev.some((category) => category.id === saved.id);
      return exists
        ? prev.map((category) => (category.id === saved.id ? saved : category))
        : [saved, ...prev];
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('categories.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('categories.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {canManageCatalogTrash(user) && (
            <Link to="/catalog/categories/trash">
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                {t('common.trash')}
              </Button>
            </Link>
          )}
          {canCreateService(user) && (
            <Button onClick={() => setFormModalState({ open: true, category: null })}>
              <Plus className="h-4 w-4" />
              {t('categories.newCategory')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.search')}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('categories.searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('common.sortBy')}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="name">{t('common.sortName')}</option>
            <option value="created_at">{t('common.sortCreatedAt')}</option>
          </Select>
        </div>
        <div className="sm:w-14">
          <button
            type="button"
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? t('common.asc') : t('common.desc')}
            className="flex h-[42px] w-full items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('categories.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('categories.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('categories.colDescription')}</th>
                  <th className="px-5 py-3 font-medium">{t('categories.colServices')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700"
                          style={{ backgroundColor: category.color ?? '#CBD5E1' }}
                        >
                          <CategoryIcon name={category.icon} className="h-5 w-5 text-white" />
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {category.name}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 text-gray-600 dark:text-gray-300">
                      {category.description ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {category.services_count ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailCategory(category)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditService(user) && (
                          <button
                            type="button"
                            onClick={() => setFormModalState({ open: true, category })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteService(user) && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(category)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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

      <CategoryFormModal
        isOpen={formModalState.open}
        category={formModalState.category}
        onClose={() => setFormModalState({ open: false, category: null })}
        onSaved={handleSaved}
      />

      <CategoryDetailModal category={detailCategory} onClose={() => setDetailCategory(null)} />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('categories.archiveTitle')}
        message={t('categories.archiveMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('categories.archive')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
