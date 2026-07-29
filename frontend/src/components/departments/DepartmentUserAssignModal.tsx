import { useEffect, useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { client } from '@/api/client';
import type { UserListItem } from '@/types/user';
import type { Department } from '@/types/department';

const NON_ASSIGNABLE_ROLES = new Set(['super-admin', 'direction-generale']);

interface DepartmentUserAssignModalProps {
  isOpen: boolean;
  department: Department | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DepartmentUserAssignModal({
  isOpen,
  department,
  onClose,
  onSaved,
}: DepartmentUserAssignModalProps) {
  const { showToast } = useToast();
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<UserListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !department) return;

    setIsLoading(true);
    setError(null);
    setSelectedIds(new Set());

    Promise.all([
      client.get(`/departments/${department.id}`),
      client.get(`/agencies/${department.agency_id}/users`),
    ])
      .then(([deptRes, agencyUsersRes]) => {
        const deptData = deptRes.data;
        const deptAssigned = deptData.assigned_users ?? [];
        setAssignedUsers(deptAssigned);

        const assignedIds = new Set(deptAssigned.map((u: any) => u.id));
        const available: UserListItem[] = agencyUsersRes.data.filter(
          (u: UserListItem) =>
            !assignedIds.has(u.id) &&
            !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
        );
        setAgencyUsers(available);
      })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, department]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssignMultiple() {
    if (!department || selectedIds.size === 0) return;
    setIsSubmitting(true);
    setError(null);

    const errors: string[] = [];
    let successCount = 0;

    for (const userId of selectedIds) {
      try {
        await client.post(`/departments/${department.id}/users`, {
          user_id: userId,
        });
        successCount++;
      } catch (err) {
        errors.push(extractErrorMessage(err, "Erreur"));
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} utilisateur(s) assigné(s) avec succès.`, 'success');
      onSaved();

      const deptRes = await client.get(`/departments/${department.id}`);
      const deptAssigned = deptRes.data.assigned_users ?? [];
      setAssignedUsers(deptAssigned);
      const assignedIds = new Set(deptAssigned.map((u: any) => u.id));
      const agencyUsersRes = await client.get(
        `/agencies/${department.agency_id}/users`
      );
      const available: UserListItem[] = agencyUsersRes.data.filter(
        (u: UserListItem) =>
          !assignedIds.has(u.id) &&
          !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
      );
      setAgencyUsers(available);
      setSelectedIds(new Set());
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
    }

    setIsSubmitting(false);
  }

  async function handleRemove(user: any) {
    if (!department) return;
    try {
      await client.delete(`/departments/${department.id}/users/${user.id}`);
      showToast('Utilisateur retiré du département avec succès.', 'success');
      onSaved();

      setAssignedUsers((prev) => prev.filter((u: any) => u.id !== user.id));
      setAgencyUsers((prev) => [...prev, { ...user }]);
    } catch (err) {
      showToast(extractErrorMessage(err, "Impossible de retirer l'utilisateur."), 'error');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Utilisateurs — ${department?.name ?? ''}`}
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
                Assignés au département ({assignedUsers.length})
              </p>
              {assignedUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aucun utilisateur assigné à ce département.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {assignedUsers.map((u: any) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {u.name}
                        </span>
                        <span className="text-gray-400">{u.email}</span>
                        {u.role && (
                          <Badge variant="neutral">{u.role.name}</Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(u)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                        title="Retirer du département"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {agencyUsers.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                  Utilisateurs de l'agence ({agencyUsers.length})
                </p>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
                  {agencyUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelection(u.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {u.name}
                      </span>
                      <span className="text-gray-400">{u.email}</span>
                      {u.role && (
                        <Badge variant="neutral">{u.role.name}</Badge>
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={handleAssignMultiple}
                    isLoading={isSubmitting}
                    disabled={selectedIds.size === 0}
                  >
                    <UserPlus className="h-4 w-4" />
                    Assigner ({selectedIds.size})
                  </Button>
                </div>
              </div>
            )}

            {agencyUsers.length === 0 && assignedUsers.length > 0 && (
              <p className="text-sm text-gray-400">
                Tous les utilisateurs de l'agence sont déjà assignés à ce département.
              </p>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
