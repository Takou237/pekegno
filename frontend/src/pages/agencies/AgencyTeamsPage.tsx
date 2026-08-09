import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, UserPlus, UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { client } from '@/api/client';
import { usersApi } from '@/api/users.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { AssignMemberModal } from '@/components/users/AssignMemberModal';
import type { Agency } from '@/types/agency';
import type { UserListItem } from '@/types/user';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

export default function AgencyTeamsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const { agency, agencyId } = useOutletContext<AgencyLayoutContext>();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ id: string; name: string } | null>(null);

  const canCreateUsers = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );
  const canManageUsers = ['super-admin', 'direction-generale'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchUsers = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await usersApi.list({
        agency_id: agencyId,
        search: search || undefined,
        per_page: 100,
      });
      setUsers(response.data);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('users.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, search, t]);

  useEffect(() => {
    const timeout = setTimeout(fetchUsers, 350);
    return () => clearTimeout(timeout);
  }, [fetchUsers]);

  function openAssign() {
    setAssignTarget({ id: agencyId ?? '', name: agency?.name ?? '' });
    setAssignOpen(true);
  }

  async function handleRemove(userId: string, userName: string) {
    if (!agencyId) return;
    if (!window.confirm(t('users.removeConfirm', { name: userName }))) return;
    try {
      await client.delete(`/agencies/${agencyId}/users/${userId}`);
      showToast(t('users.removed'), 'success');
      fetchUsers();
    } catch (error) {
      showToast(extractErrorMessage(error, t('users.removeFailed')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.teams')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('users.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {canCreateUsers && (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              {t('users.createUser')}
            </Button>
          )}
          {canManageUsers && agencyId && (
            <Button variant="outline" onClick={openAssign}>
              <UserPlus className="h-4 w-4" />
              {t('users.assignUser')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('users.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('users.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('users.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('users.colEmail')}</th>
                  <th className="px-5 py-3 font-medium">{t('users.colPhone')}</th>
                  <th className="px-5 py-3 font-medium">{t('users.colRole')}</th>
                  {canManageUsers && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {(user.name || user.first_name || user.username || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {user.name || user.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{user.email}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {user.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {user.role ? (
                        <Badge variant="brand">{user.role.name}</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    {canManageUsers && (
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemove(user.id, user.name ?? user.username)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title={t('users.remove')}
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchUsers}
        fixedAgencyId={agencyId}
        fixedAgencyName={agency?.name}
      />

      <AssignMemberModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={fetchUsers}
        targetType="agency"
        targetId={assignTarget?.id ?? ''}
        targetName={assignTarget?.name ?? ''}
      />
    </div>
  );
}
