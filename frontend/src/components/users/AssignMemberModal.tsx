import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserMinus } from 'lucide-react';
import { client } from '@/api/client';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import type { UserListItem } from '@/types/user';
import type { AssignedUser } from '@/types/agency';

interface AssignMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
  targetType: 'agency' | 'department';
  targetId: string;
  targetName: string;
}

const NON_ASSIGNABLE_ROLES = new Set(['super-admin', 'direction-generale']);

export function AssignMemberModal({
  isOpen,
  onClose,
  onAssigned,
  targetType,
  targetId,
  targetName,
}: AssignMemberModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!isOpen || !targetId) return;
    setIsLoading(true);
    setError(null);
    try {
      if (targetType === 'agency') {
        const [agencyRes, usersRes] = await Promise.all([
          client.get(`/agencies/${targetId}`),
          client.get('/users', { params: { per_page: 100 } }),
        ]);
        const data = agencyRes.data.data ?? agencyRes.data;
        const assigned = data.assigned_users ?? [];
        setAssignedUsers(assigned);
        const assignedIds = new Set(assigned.map((u: AssignedUser) => u.id));
        setAvailableUsers(
          (usersRes.data.data ?? usersRes.data).filter(
            (u: UserListItem) =>
              !assignedIds.has(u.id) &&
              !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
          )
        );
      } else {
        const [deptRes, agencyRes] = await Promise.all([
          client.get(`/departments/${targetId}`),
          client.get('/users', { params: { per_page: 100 } }),
        ]);
        const dept = deptRes.data.data ?? deptRes.data;
        const deptUsers: AssignedUser[] = dept.assigned_users ?? [];
        const deptUserIds = new Set(deptUsers.map((u: AssignedUser) => u.id));
        setAssignedUsers(deptUsers);

        const agencyId = dept.agency_id;
        const allUsers: UserListItem[] = agencyRes.data.data ?? agencyRes.data;
        setAvailableUsers(
          allUsers.filter(
            (u: UserListItem) =>
              !deptUserIds.has(u.id) &&
              !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
          )
        );
        void agencyId;
      }
    } catch {
      setError(t('users.dataLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetType, targetId]);

  async function handleAssign(userId: string) {
    const endpoint =
      targetType === 'agency'
        ? `/agencies/${targetId}/users`
        : `/departments/${targetId}/users`;
    try {
      await client.post(endpoint, { user_id: userId });
      showToast(t('users.assigned'), 'success');
      onAssigned();
      await loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('users.assignFailed')), 'error');
      setError(extractErrorMessage(err, t('users.assignFailed')));
    }
  }

  async function handleRemove(userId: string) {
    const endpoint =
      targetType === 'agency'
        ? `/agencies/${targetId}/users/${userId}`
        : `/departments/${targetId}/users/${userId}`;
    try {
      await client.delete(endpoint);
      showToast(t('users.removed'), 'success');
      onAssigned();
      await loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('users.removeFailed')), 'error');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('users.assignTitle', { name: targetName })}
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                {t('users.assignedCount', { count: assignedUsers.length })}
              </p>
              {assignedUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('users.noAssigned')}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {assignedUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        {targetType === 'agency' && u.pivot?.is_primary && (
                          <Badge variant="warning">{t('users.chief')}</Badge>
                        )}
                        {targetType === 'department' && u.pivot?.is_department_chief && (
                          <Badge variant="warning">{t('users.chief')}</Badge>
                        )}
                        <span className="font-medium text-gray-800 dark:text-gray-100">{u.name}</span>
                        <span className="text-gray-400">{u.email}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(u.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                        title={t('users.remove')}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase text-gray-400">{t('users.add')}</p>
              <Autocomplete
                placeholder={
                  availableUsers.length === 0 ? t('users.noAvailableUsers') : t('users.searchByNameEmail')
                }
                value=""
                onChange={(userId) => {
                  if (userId) handleAssign(userId);
                }}
                fetchOptions={async (query) => {
                  const q = query.toLowerCase();
                  return availableUsers
                    .filter(
                      (u) =>
                        u.name?.toLowerCase().includes(q) ||
                        u.email.toLowerCase().includes(q)
                    )
                    .slice(0, 20)
                    .map((u) => ({
                      id: u.id,
                      label: u.name ?? u.email,
                      subtitle: u.role?.name ? `${u.email} — ${u.role.name}` : u.email,
                    }));
                }}
                disabled={availableUsers.length === 0}
              />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
