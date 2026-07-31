import { useCallback, useEffect, useState } from 'react';
import { Search, Eye, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import type { UserListItem } from '@/types/user';
import type { PaginationMeta } from '@/types/agency';

export default function ClientsListPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [clients, setClients] = useState<UserListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [viewClient, setViewClient] = useState<UserListItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchClients = useCallback(async (filters: { search?: string; page: number }) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await clientsApi.list({
        search: filters.search || undefined,
        page: filters.page,
        per_page: 15,
      });
      setClients(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('clients.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients({ search, page });
  }, [search, page, fetchClients]);

  async function toggleActive(client: UserListItem) {
    setTogglingId(client.id);
    try {
      const updated = await clientsApi.update(client.id, { is_active: !client.is_active });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(
        updated.is_active ? t('clients.reactivated') : t('clients.deactivated'),
        'success'
      );
    } catch (error) {
      showToast(extractErrorMessage(error, t('clients.updateFailed')), 'error');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('clients.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('clients.subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.search')}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('clients.searchPlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('clients.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('clients.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colEmail')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colPhone')}</th>
                  <th className="px-5 py-3 font-medium">{t('clients.colRegistered')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {c.name || c.username}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{c.email}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleDateString(currentLocale(), {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {c.is_active ? (
                        <Badge variant="success">{t('common.active')}</Badge>
                      ) : (
                        <Badge variant="error">{t('common.inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewClient(c)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('common.viewDetails')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={togglingId === c.id}
                          disabled={togglingId === c.id}
                          onClick={() => toggleActive(c)}
                          title={c.is_active ? t('clients.deactivateAccount') : t('clients.reactivateAccount')}
                        >
                          {c.is_active ? (
                            <UserRoundX className="h-4 w-4" />
                          ) : (
                            <UserRoundCheck className="h-4 w-4" />
                          )}
                          {c.is_active ? t('clients.deactivate') : t('clients.reactivate')}
                        </Button>
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

      <Modal
        isOpen={Boolean(viewClient)}
        onClose={() => setViewClient(null)}
        title={t('clients.detailTitle')}
        maxWidth="max-w-md"
      >
        {viewClient && (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colName')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.name || viewClient.username}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colEmail')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('clients.colPhone')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewClient.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">{t('common.status')}</dt>
              <dd className="text-gray-800 dark:text-gray-100">
                {viewClient.is_active ? t('common.active') : t('common.inactive')}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
