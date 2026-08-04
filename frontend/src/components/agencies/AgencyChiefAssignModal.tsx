import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { client } from '@/api/client';
import { usersApi } from '@/api/users.api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Agency } from '@/types/agency';
import type { RoleListItem } from '@/types/user';
import { CHIEF_ROLE_NAMES } from '@/utils/employeeRoles';

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
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [currentChiefId, setCurrentChiefId] = useState<string>('');
  const [currentChiefName, setCurrentChiefName] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showOldChiefDialog, setShowOldChiefDialog] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [showFireConfirm, setShowFireConfirm] = useState(false);
  const [fireSubmitting, setFireSubmitting] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !agency) return;

    setIsLoading(true);
    setError(null);
    setSelectedUserId('');
    setCurrentChiefId('');
    setCurrentChiefName('');
    setAssignedUserIds(new Set());

    client
      .get(`/agencies/${agency.id}`)
      .then(({ data }) => {
        const agencyData = data.data ?? data;
        const assigned = agencyData.assigned_users ?? [];
        const chief = assigned.find((u: any) => u.pivot?.is_primary === true);
        const chiefId = chief?.id ?? '';
        setCurrentChiefId(chiefId);
        setCurrentChiefName(chief ? `${chief.first_name ?? ''} ${chief.last_name ?? ''}`.trim() || chief.email : '');
        setSelectedUserId(chiefId);
        setAssignedUserIds(new Set(assigned.map((u: any) => u.id)));
      })
      .catch(() => setError(t('agencies.chiefDataFailed')))
      .finally(() => setIsLoading(false));

    usersApi.listRoles().then(setRoles).catch(() => {});
  }, [isOpen, agency]);

  async function fetchUsers(query: string): Promise<AutocompleteOption[]> {
    if (assignedUserIds.size === 0) return [];

    const { data } = await client.get('/users', {
      params: { search: query, per_page: 10 },
    });
    const users = data.data ?? [];
    return users
      .filter((u: any) =>
        assignedUserIds.has(u.id) &&
        u.role?.name !== 'super-admin' &&
        u.role?.name !== 'direction-generale' &&
        u.role?.name !== 'client'
      )
      .map((u: any) => ({
        id: u.id,
        label: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email,
        subtitle: u.email,
      }));
  }

  async function handleAssign() {
    if (!agency) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (selectedUserId) {
        await client.put(`/agencies/${agency.id}/chief`, {
          user_id: selectedUserId,
        });
        showToast(t('agencies.chiefAssigned'), 'success');

        if (currentChiefId && currentChiefId !== selectedUserId) {
          setShowOldChiefDialog(true);
        } else {
          onSaved();
          onClose();
        }
      } else if (currentChiefId) {
        await client.delete(`/agencies/${agency.id}/chief`);
        showToast(t('agencies.chiefRemoved'), 'success');
        onSaved();
        onClose();
      } else {
        onClose();
        return;
      }
    } catch (err) {
      setError(extractErrorMessage(err, t('agencies.chiefAssignFailed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignNewRole() {
    if (!newRoleId || !currentChiefId) return;
    setIsRoleSubmitting(true);
    try {
      await usersApi.assignRole(currentChiefId, newRoleId);
      showToast(t('agencies.roleAssigned'), 'success');
      setShowOldChiefDialog(false);
      onSaved();
      onClose();
    } catch (err) {
      showToast(extractErrorMessage(err, t('agencies.roleAssignFailed')), 'error');
    } finally {
      setIsRoleSubmitting(false);
    }
  }

  function handleSkipRole() {
    setShowOldChiefDialog(false);
    onSaved();
    onClose();
  }

  async function handleFireChief() {
    if (!currentChiefId) return;
    setFireSubmitting(true);
    try {
      await usersApi.remove(currentChiefId);
      showToast(t('agencies.userFired'), 'success');
      setShowFireConfirm(false);
      setShowOldChiefDialog(false);
      onSaved();
      onClose();
    } catch (err) {
      showToast(extractErrorMessage(err, t('agencies.fireFailed')), 'error');
    } finally {
      setFireSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('agencies.chiefTitle', { name: agency?.name ?? '' })}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}

          {isLoading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : (
            <>
              <Autocomplete
                label={t('agencies.chiefLabel')}
                placeholder={t('agencies.chiefSearchPlaceholder')}
                value={selectedUserId}
                onChange={setSelectedUserId}
                fetchOptions={fetchUsers}
              />
              <p className="text-xs text-gray-400">
                {t('agencies.chiefHint')}
              </p>
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAssign} isLoading={isSubmitting} disabled={isLoading} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showOldChiefDialog}
        onClose={handleSkipRole}
        title={t('agencies.oldChiefTitle')}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {currentChiefName ? (
              <Trans t={t} i18nKey="agencies.oldChiefMessage" values={{ name: currentChiefName }} />
            ) : (
              t('agencies.oldChiefMessageNoName')
            )}
          </p>

          <Select
            label={t('agencies.assignNewRole')}
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
          >
            <option value="">{t('agencies.noRole')}</option>
            {roles
              .filter((r) => r.name !== 'client' && !CHIEF_ROLE_NAMES.has(r.name))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="danger" onClick={() => setShowFireConfirm(true)}>
              {t('agencies.fire')}
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleSkipRole}>
                {t('agencies.skip')}
              </Button>
              <Button
                onClick={handleAssignNewRole}
                isLoading={isRoleSubmitting}
                disabled={!newRoleId}
              >
                {t('agencies.assignRole')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showFireConfirm}
        onCancel={() => setShowFireConfirm(false)}
        onConfirm={handleFireChief}
        title={t('agencies.fireTitle')}
        message={t('agencies.fireMessage', { name: currentChiefName })}
        confirmLabel={t('agencies.fire')}
        isLoading={fireSubmitting}
      />
    </>
  );
}
