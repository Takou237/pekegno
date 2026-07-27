import { useEffect, useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
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

interface AssignedUser extends UserListItem {
  pivot?: {
    agency_id: string;
    is_primary: boolean;
  };
}

export function DepartmentUserAssignModal({
  isOpen,
  department,
  onClose,
  onSaved,
}: DepartmentUserAssignModalProps) {
  const { showToast } = useToast();
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [agencyUsers, setAgencyUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !department) return;

    setIsLoading(true);
    setError(null);

    Promise.all([
      client.get(`/departments/${department.id}`),
      client.get(`/agencies/${department.agency_id}/users`),
    ])
      .then(([deptRes, agencyUsersRes]) => {
        const deptData = deptRes.data;
        const deptAssigned = deptData.assigned_users ?? [];
        setAssignedUsers(deptAssigned);

        const assignedIds = new Set(deptAssigned.map((u: AssignedUser) => u.id));
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

  async function handleAssign() {
    if (!department || !selectedUserId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await client.post(`/departments/${department.id}/users`, {
        user_id: selectedUserId,
      });
      showToast('Utilisateur assigné au département avec succès.', 'success');
      setSelectedUserId('');
      onSaved();

      const deptRes = await client.get(`/departments/${department.id}`);
      const deptAssigned = deptRes.data.assigned_users ?? [];
      setAssignedUsers(deptAssigned);
      const assignedIds = new Set(deptAssigned.map((u: AssignedUser) => u.id));
      const agencyUsersRes = await client.get(
        `/agencies/${department.agency_id}/users`
      );
      const available: UserListItem[] = agencyUsersRes.data.filter(
        (u: UserListItem) =>
          !assignedIds.has(u.id) &&
          !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
      );
      setAgencyUsers(available);
    } catch (err) {
      setError(extractErrorMessage(err, "Impossible d'assigner l'utilisateur."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(user: AssignedUser) {
    if (!department) return;
    try {
      await client.delete(`/departments/${department.id}/users/${user.id}`);
      showToast('Utilisateur retiré du département avec succès.', 'success');
      onSaved();

      setAssignedUsers((prev) => prev.filter((u) => u.id !== user.id));
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
                  {assignedUsers.map((u) => (
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
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label="Ajouter un utilisateur de l'agence"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">— Sélectionner —</option>
                    {agencyUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  onClick={handleAssign}
                  isLoading={isSubmitting}
                  disabled={!selectedUserId}
                >
                  <UserPlus className="h-4 w-4" />
                  Assigner
                </Button>
              </div>
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
