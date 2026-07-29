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
import type { Agency } from '@/types/agency';

const NON_ASSIGNABLE_ROLES = new Set(['super-admin', 'direction-generale']);

interface AgencyUserAssignModalProps {
  isOpen: boolean;
  agency: Agency | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AgencyUserAssignModal({
  isOpen,
  agency,
  onClose,
  onSaved,
}: AgencyUserAssignModalProps) {
  const { showToast } = useToast();
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !agency) return;

    setIsLoading(true);
    setError(null);
    setSelectedIds(new Set());

    Promise.all([
      client.get(`/agencies/${agency.id}`),
      client.get('/users', { params: { per_page: 100 } }),
    ])
      .then(([agencyRes, usersRes]) => {
        const agencyData: Agency = agencyRes.data;
        setAssignedUsers(agencyData.assigned_users ?? []);

        const assignedIds = new Set(
          (agencyData.assigned_users ?? []).map((u: any) => u.id)
        );
        const available: UserListItem[] = (usersRes.data.data ?? usersRes.data).filter(
          (u: UserListItem) =>
            !assignedIds.has(u.id) &&
            !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
        );
        setAvailableUsers(available);
      })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, agency]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssignMultiple() {
    if (!agency || selectedIds.size === 0) return;
    setIsSubmitting(true);
    setError(null);

    const errors: string[] = [];
    let successCount = 0;

    for (const userId of selectedIds) {
      try {
        await client.post(`/agencies/${agency.id}/users`, {
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

      const agencyRes = await client.get(`/agencies/${agency.id}`);
      const agencyData: Agency = agencyRes.data;
      setAssignedUsers(agencyData.assigned_users ?? []);
      const assignedIds = new Set(
        (agencyData.assigned_users ?? []).map((u: any) => u.id)
      );
      const usersRes = await client.get('/users', { params: { per_page: 100 } });
      const available: UserListItem[] = (usersRes.data.data ?? usersRes.data).filter(
        (u: UserListItem) =>
          !assignedIds.has(u.id) &&
          !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
      );
      setAvailableUsers(available);
      setSelectedIds(new Set());
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
    }

    setIsSubmitting(false);
  }

  async function handleRemove(user: any) {
    if (!agency) return;
    try {
      await client.delete(`/agencies/${agency.id}/users/${user.id}`);
      showToast('Utilisateur retiré avec succès.', 'success');
      onSaved();

      setAssignedUsers((prev) => prev.filter((u: any) => u.id !== user.id));
      setAvailableUsers((prev) => [...prev, { ...user }]);
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
                  {assignedUsers.map((u: any) => (
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

            {availableUsers.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                  Disponibles ({availableUsers.length})
                </p>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
                  {availableUsers.map((u) => (
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

            {availableUsers.length === 0 && assignedUsers.length > 0 && (
              <p className="text-sm text-gray-400">Tous les utilisateurs disponibles sont déjà assignés.</p>
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
