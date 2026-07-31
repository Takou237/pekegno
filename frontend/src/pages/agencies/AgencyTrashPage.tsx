import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Agency, PaginationMeta } from '@/types/agency';

export default function AgencyTrashPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<Agency | null>(null);
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const fetchTrash = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await agenciesApi.trash({ page, per_page: 15 });
      setAgencies(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('agencies.trashLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(agency: Agency) {
    try {
      await agenciesApi.restore(agency.id);
      showToast(t('agencies.restored', { name: agency.name }), 'success');
      setAgencies((prev) => prev.filter((item) => item.id !== agency.id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('agencies.restoreFailed')), 'error');
    }
  }

  async function handleForceDelete() {
    if (!forceDeleteTarget) return;
    setIsForceDeleting(true);
    try {
      await agenciesApi.forceDelete(forceDeleteTarget.id);
      showToast(t('agencies.forceDeleted'), 'success');
      setAgencies((prev) => prev.filter((item) => item.id !== forceDeleteTarget.id));
      setForceDeleteTarget(null);
    } catch (error) {
      showToast(
        extractErrorMessage(error, t('agencies.forceDeleteFailed')),
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
          to="/agencies"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('agencies.backToAgencies')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('agencies.trashTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('agencies.trashSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : agencies.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.trashEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('agencies.colCode')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencies.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencies.deletedAt')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {agencies.map((agency) => (
                  <tr key={agency.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{agency.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {agency.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {agency.deleted_at ? new Date(agency.deleted_at).toLocaleDateString(currentLocale()) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRestore(agency)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-success-600 dark:hover:bg-gray-800"
                          title={t('common.restore')}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setForceDeleteTarget(agency)}
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
        title={t('agencies.forceDeleteTitle')}
        message={t('agencies.forceDeleteMessage', { name: forceDeleteTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        isLoading={isForceDeleting}
        onConfirm={handleForceDelete}
        onCancel={() => setForceDeleteTarget(null)}
      />
    </div>
  );
}
