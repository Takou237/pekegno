import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Department } from '@/types/department';
import type { PaginationMeta } from '@/types/agency';

interface DepartmentTrashPageProps {
  agencyId?: string;
}

export default function DepartmentTrashPage({ agencyId }: DepartmentTrashPageProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<Department | null>(null);
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const fetchTrash = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await departmentsApi.trash({
        page,
        per_page: 15,
        agency_id: agencyId ?? undefined,
      });
      setDepartments(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('departments.trashLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [page, agencyId]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(dept: Department) {
    try {
      await departmentsApi.restore(dept.id);
      showToast(t('departments.restored', { name: dept.name }), 'success');
      setDepartments((prev) => prev.filter((item) => item.id !== dept.id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('departments.restoreFailed')), 'error');
    }
  }

  async function handleForceDelete() {
    if (!forceDeleteTarget) return;
    setIsForceDeleting(true);
    try {
      await departmentsApi.forceDelete(forceDeleteTarget.id);
      showToast(t('departments.forceDeleted'), 'success');
      setDepartments((prev) => prev.filter((item) => item.id !== forceDeleteTarget.id));
      setForceDeleteTarget(null);
    } catch (error) {
      showToast(
        extractErrorMessage(error, t('departments.forceDeleteFailed')),
        'error'
      );
    } finally {
      setIsForceDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={agencyId ? `/agencies/${agencyId}/departments` : '/departments'}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('departments.backToDepartments')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('departments.trashTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('departments.trashSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : departments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.trashEmpty')}</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                      {dept.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{dept.name}</p>
                      <p className="truncate text-xs text-gray-400">{dept.agency?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleRestore(dept)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-success-600 dark:hover:bg-gray-800"
                      title={t('common.restore')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceDeleteTarget(dept)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title={t('common.deletePermanently')}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 flex-1 text-sm text-gray-500 dark:text-gray-400">
                  {dept.description ?? '—'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('departments.deletedAt')}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {dept.deleted_at
                      ? new Date(dept.deleted_at).toLocaleDateString(currentLocale())
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
        title={t('departments.forceDeleteTitle')}
        message={t('departments.forceDeleteMessage', { name: forceDeleteTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        isLoading={isForceDeleting}
        onConfirm={handleForceDelete}
        onCancel={() => setForceDeleteTarget(null)}
      />
    </div>
  );
}
