import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { client } from '@/api/client';
import type { UserListItem } from '@/types/user';
import type { Agency } from '@/types/agency';

interface AgencyChiefAssignModalProps {
  isOpen: boolean;
  agency: Agency | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AgencyChiefAssignModal({
  isOpen,
  agency,
  onClose,
  onSaved,
}: AgencyChiefAssignModalProps) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [currentChiefId, setCurrentChiefId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !agency) return;

    setIsLoading(true);
    setError(null);

    // Charger les utilisateurs assignés à cette agence
    client
      .get(`/agencies/${agency.id}`)
      .then(({ data }) => {
        const agencyData = data.data ?? data;
        const assigned = agencyData.assigned_users ?? [];
        setUsers(assigned);

        // Trouver le chef actuel (is_primary dans le pivot)
        // On charge aussi depuis le pivot directement
        const chief = assigned.find(
          (u: any) => u.pivot?.is_primary === true
        );
        const chiefId = chief?.id ?? '';
        setCurrentChiefId(chiefId);
        setSelectedUserId(chiefId);
      })
      .catch(() => setError('Impossible de charger les données.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, agency]);

  async function handleAssign() {
    if (!agency) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (selectedUserId) {
        await client.put(`/agencies/${agency.id}/chief`, {
          user_id: selectedUserId,
        });
        showToast('Chef d\'agence assigné avec succès.', 'success');
      } else if (currentChiefId) {
        await client.delete(`/agencies/${agency.id}/chief`);
        showToast('Chef d\'agence retiré avec succès.', 'success');
      } else {
        onClose();
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, "Impossible d'assigner le chef d'agence."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chef d'agence — ${agency?.name ?? ''}`}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        {isLoading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucun utilisateur assigné à cette agence. Assignez d'abord un utilisateur à cette
            agence avant de le désigner comme chef.
          </p>
        ) : (
          <>
            <Select
              label="Chef d'agence"
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
              Un seul chef par agence. Un chef peut gérer plusieurs agences.
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
