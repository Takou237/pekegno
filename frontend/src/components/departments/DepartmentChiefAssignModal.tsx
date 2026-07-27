import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { client } from '@/api/client';
import type { UserListItem } from '@/types/user';
import type { Department } from '@/types/department';

interface DepartmentChiefAssignModalProps {
  isOpen: boolean;
  department: Department | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DepartmentChiefAssignModal({
  isOpen,
  department,
  onClose,
  onSaved,
}: DepartmentChiefAssignModalProps) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [currentChiefId, setCurrentChiefId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !department) return;

    setIsLoading(true);
    setError(null);

    client
      .get(`/departments/${department.id}`)
      .then(({ data }) => {
        const assigned = data.assigned_users ?? [];
        setUsers(assigned);

        const chief = assigned.find(
          (u: any) => u.pivot?.is_department_chief === true
        );
        const chiefId = chief?.id ?? '';
        setCurrentChiefId(chiefId);
        setSelectedUserId(chiefId);
      })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, department]);

  async function handleAssign() {
    if (!department) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (selectedUserId) {
        await client.put(`/departments/${department.id}/chief`, {
          user_id: selectedUserId,
        });
        showToast('Chef de département assigné avec succès.', 'success');
      } else if (currentChiefId) {
        await client.delete(`/departments/${department.id}/chief`);
        showToast('Chef de département retiré avec succès.', 'success');
      } else {
        onClose();
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, "Impossible d'assigner le chef de département."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chef de département — ${department?.name ?? ''}`}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        {isLoading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucun utilisateur assigné à ce département. Assignez d'abord un utilisateur avant de le
            désigner comme chef.
          </p>
        ) : (
          <>
            <Select
              label="Chef de département"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">— Aucun chef —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-400">
              Un seul chef par département. Un chef peut gérer plusieurs départements.
            </p>
          </>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleAssign}
            isLoading={isSubmitting}
            disabled={isLoading || users.length === 0}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
