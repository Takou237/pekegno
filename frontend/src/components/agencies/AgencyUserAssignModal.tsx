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
import type { Agency } from '@/types/agency';

const NON_ASSIGNABLE_ROLES = new Set(['super-admin', 'direction-generale']);

interface AgencyUserAssignModalProps {
  isOpen: boolean;
  agency: Agency | null;
  onClose: () => void;
  onSaved: () => void;
}

interface AssignedUser extends UserListItem {
  pivot?: {
    department_id: string | null;
    is_primary: boolean;
  };
}

export function AgencyUserAssignModal({
  isOpen,
  agency,
  onClose,
  onSaved,
}: AgencyUserAssignModalProps) {
  const { showToast } = useToast();
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !agency) return;

    setIsLoading(true);
    setError(null);

    Promise.all([
      client.get(`/agencies/${agency.id}`),
      client.get('/users', { params: { per_page: 100 } }),
    ])
      .then(([agencyRes, usersRes]) => {
        const agencyData: Agency = agencyRes.data;
        setAssignedUsers(agencyData.assigned_users ?? []);

        const assignedIds = new Set(
          (agencyData.assigned_users ?? []).map((u: AssignedUser) => u.id)
        );
        const available: UserListItem[] = (usersRes.data.data ?? usersRes.data).filter(
          (u: UserListItem) =>
            !assignedIds.has(u.id) &&
            !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
        );
        setAllUsers(available);
      })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, agency]);

  async function handleAssign() {
    if (!agency || !selectedUserId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await client.post(`/agencies/${agency.id}/users`, {
        user_id: selectedUserId,
      });
      showToast('Utilisateur assigné avec succès.', 'success');
      setSelectedUserId('');
      onSaved();

      const agencyRes = await client.get(`/agencies/${agency.id}`);
      const agencyData: Agency = agencyRes.data;
      setAssignedUsers(agencyData.assigned_users ?? []);
      const assignedIds = new Set(
        (agencyData.assigned_users ?? []).map((u: AssignedUser) => u.id)
      );
      const usersRes = await client.get('/users', { params: { per_page: 100 } });
      const available: UserListItem[] = (usersRes.data.data ?? usersRes.data).filter(
        (u: UserListItem) =>
          !assignedIds.has(u.id) &&
          !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
      );
      setAllUsers(available);
    } catch (err) {
      setError(extractErrorMessage(err, "Impossible d'assigner l'utilisateur."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(user: AssignedUser) {
    if (!agency) return;
    try {
      await client.delete(`/agencies/${agency.id}/users/${user.id}`);
      showToast('Utilisateur retiré avec succès.', 'success');
      onSaved();

      setAssignedUsers((prev) => prev.filter((u) => u.id !== user.id));
      setAllUsers((prev) => [...prev, { ...user }]);
    } catch (err) {
      showToast(extractErrorMessage(err, "Impossible de retirer l'utilisateur."), 'error');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Utilisateurs — ${agency?.name ?? ''}`}
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
                Assignés ({assignedUsers.length})
              </p>
              {assignedUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Aucun utilisateur assigné.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {assignedUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        {u.pivot?.is_primary && (
                          <Badge variant="warning">Chef</Badge>
                        )}
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
                        title="Retirer de l'agence"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {allUsers.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    label="Ajouter un utilisateur"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">— Sélectionner —</option>
                    {allUsers.map((u) => (
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
