import { useEffect, useMemo, useState } from 'react';
import { Download, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { activityLogsApi } from '@/api/activityLogs.api';
import { usersApi } from '@/api/users.api';
import { extractErrorMessage } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { canExportData } from '@/utils/exportPermissions';
import type { ActivityLog } from '@/types/activityLog';
import type { PaginationMeta } from '@/types/agency';
import type { UserListItem } from '@/types/user';

const ENTITY_TYPES = [
  'client',
  'commercial',
  'invoice',
  'user',
  'agency',
  'department',
  'service',
  'category',
  'promotion',
  'setting',
  'auth',
];

const ACTIONS = [
  'created',
  'updated',
  'deleted',
  'restored',
  'paid',
  'cancelled',
  'exported',
  'logged_in',
  'logged_out',
  'points_adjusted',
  'role_changed',
];

export default function ActivityLogPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    usersApi
      .list({ per_page: 100 })
      .then((response) => setUsers(response.data))
      .catch(() => {});
  }, []);

  const fetchParams = useMemo(
    () => ({
      entity_type: entityFilter === 'all' ? undefined : entityFilter,
      action: actionFilter === 'all' ? undefined : actionFilter,
      user_id: userFilter === 'all' ? undefined : userFilter,
      from: from || undefined,
      to: to || undefined,
      page,
    }),
    [entityFilter, actionFilter, userFilter, from, to, page]
  );

  async function fetchLogs() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await activityLogsApi.list({ ...fetchParams, per_page: 15 });
      setLogs(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('audit.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(timeout);
  }, [entityFilter, actionFilter, userFilter, from, to]);

  function entityLabel(entity: string): string {
    const key = `audit.entity${entity.charAt(0).toUpperCase()}${entity.slice(1)}`;
    const label = t(key);
    return label === key ? entity : label;
  }

  function actionLabel(action: string): string {
    const key = `audit.action${action
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')}`;
    const label = t(key);
    return label === key ? action : label;
  }

  function actionVariant(action: string): 'success' | 'error' | 'warning' | 'neutral' | 'brand' {
    if (action === 'created' || action === 'paid' || action === 'logged_in') return 'success';
    if (action === 'deleted' || action === 'cancelled') return 'error';
    if (action === 'updated' || action === 'restored') return 'brand';
    return 'neutral';
  }

  function entityVariant(entity: string): 'success' | 'error' | 'warning' | 'neutral' | 'brand' {
    if (entity === 'client' || entity === 'agency') return 'brand';
    if (entity === 'commercial') return 'success';
    if (entity === 'invoice' || entity === 'payment') return 'warning';
    if (entity === 'auth') return 'neutral';
    return 'neutral';
  }

  function userName(log: ActivityLog): string {
    if (!log.user) return '—';
    return [log.user.first_name, log.user.last_name].filter(Boolean).join(' ') || log.user.email;
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('activity-logs');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('audit.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('audit.subtitle')}</p>
        </div>
        {canExportData(currentUser) && (
          <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" />
            {t('audit.export')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label={t('audit.filterEntity')}
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          <option value="all">{t('audit.allEntities')}</option>
          {ENTITY_TYPES.map((entity) => (
            <option key={entity} value={entity}>
              {entityLabel(entity)}
            </option>
          ))}
        </Select>
        <Select
          label={t('audit.filterAction')}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="all">{t('audit.allActions')}</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              {actionLabel(action)}
            </option>
          ))}
        </Select>
        <Select
          label={t('audit.filterUser')}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="all">{t('audit.allEntities')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
            </option>
          ))}
        </Select>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('audit.filterFrom')}</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('audit.filterTo')}</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <History className="h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('audit.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('audit.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('audit.colUser')}</th>
                  <th className="px-5 py-3 font-medium">{t('audit.colAction')}</th>
                  <th className="px-5 py-3 font-medium">{t('audit.colEntity')}</th>
                  <th className="px-5 py-3 font-medium">{t('audit.colDescription')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-5 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(log.created_at).toLocaleString(currentLocale(), {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-100">{userName(log)}</p>
                      {log.agency && (
                        <p className="text-xs text-gray-400">{log.agency.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={actionVariant(log.action)}>{actionLabel(log.action)}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={entityVariant(log.entity_type)}>{entityLabel(log.entity_type)}</Badge>
                    </td>
                    <td className="max-w-md px-5 py-3 text-gray-600 dark:text-gray-300">
                      {log.description ?? '—'}
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
    </div>
  );
}
