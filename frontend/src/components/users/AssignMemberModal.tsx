import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { client } from '@/api/client';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
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
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

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
        const [deptRes, usersRes] = await Promise.all([
          client.get(`/departments/${targetId}`),
          client.get('/users', { params: { per_page: 100 } }),
        ]);
        const dept = deptRes.data.data ?? deptRes.data;
        const deptUsers: AssignedUser[] = dept.assigned_users ?? [];
        const deptUserIds = new Set(deptUsers.map((u: AssignedUser) => u.id));
        setAssignedUsers(deptUsers);

        setAvailableUsers(
          (usersRes.data.data ?? usersRes.data).filter(
            (u: UserListItem) =>
              !deptUserIds.has(u.id) &&
              !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
          )
        );
      }
    } catch {
      setError(t('users.dataLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setSelectedUserId('');
    setResetKey((k) => k + 1);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetType, targetId]);

  async function handleAssign() {
    if (!selectedUserId) return;
    const endpoint =
      targetType === 'agency'
        ? `/agencies/${targetId}/users`
        : `/departments/${targetId}/users`;
    setIsSubmitting(true);
    try {
      await client.post(endpoint, { user_id: selectedUserId });
      showToast(t('users.assigned'), 'success');
      setSelectedUserId('');
      setResetKey((k) => k + 1);
      onAssigned();
      await loadData();
    } catch (err) {
      const message = extractErrorMessage(err, t('users.assignFailed'));
      showToast(message, 'error');
      setError(message);
    } finally {
      setIsSubmitting(false);
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('users.assignedCount', { count: assignedUsers.length })}
            </p>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-gray-400">
                <Search className="h-3.5 w-3.5" />
                {t('users.add')}
              </p>
              <Autocomplete
                key={resetKey}
                placeholder={
                  availableUsers.length === 0
                    ? t('users.noAvailableUsers')
                    : t('users.searchByNameEmail')
                }
                value=""
                onChange={setSelectedUserId}
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
              <Button
                className="mt-3 w-full"
                onClick={handleAssign}
                disabled={!selectedUserId || isSubmitting || availableUsers.length === 0}
              >
                <Plus className="h-4 w-4" />
                {isSubmitting ? t('common.loading') : t('users.add')}
              </Button>
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
