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
import type { RoleListItem } from '@/types/user';
import type { Department } from '@/types/department';
import { CHIEF_ROLE_NAMES } from '@/utils/employeeRoles';

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
    if (!isOpen || !department) return;

    setIsLoading(true);
    setError(null);
    setSelectedUserId('');
    setCurrentChiefId('');
    setCurrentChiefName('');
    setAssignedUserIds(new Set());

    client
      .get(`/departments/${department.id}`)
      .then(({ data }) => {
        const dept = data.data ?? data;
        const chief = dept.department_chief ?? null;
        const chiefId = chief?.id ?? '';
        setCurrentChiefId(chiefId);
        setCurrentChiefName(chief ? `${chief.name}`.trim() || chief.email : '');
        setSelectedUserId(chiefId);
      })
      .catch(() => setError(t('departments.chiefDataFailed')))
      .finally(() => setIsLoading(false));

    if (department?.agency_id) {
      client.get(`/agencies/${department.agency_id}`)
        .then(({ data }) => {
          const agencyData = data.data ?? data;
          setAssignedUserIds(new Set((agencyData.assigned_users ?? []).map((u: any) => u.id)));
        })
        .catch(() => {});
    }

    usersApi.listRoles().then(setRoles).catch(() => {});
  }, [isOpen, department]);

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
    if (!department) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (selectedUserId) {
        await client.put(`/departments/${department.id}/chief`, {
          user_id: selectedUserId,
        });
        showToast(t('departments.chiefAssigned'), 'success');

        if (currentChiefId && currentChiefId !== selectedUserId) {
          setShowOldChiefDialog(true);
        } else {
          onSaved();
          onClose();
        }
      } else if (currentChiefId) {
        await client.delete(`/departments/${department.id}/chief`);
        showToast(t('departments.chiefRemoved'), 'success');
        onSaved();
        onClose();
      } else {
        onClose();
        return;
      }
    } catch (err) {
      setError(extractErrorMessage(err, t('departments.chiefAssignFailed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignNewRole() {
    if (!newRoleId || !currentChiefId) return;
    setIsRoleSubmitting(true);
    try {
      await usersApi.assignRole(currentChiefId, newRoleId);
      showToast(t('departments.roleAssigned'), 'success');
      setShowOldChiefDialog(false);
      onSaved();
      onClose();
    } catch (err) {
      showToast(extractErrorMessage(err, t('departments.roleAssignFailed')), 'error');
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
      showToast(t('departments.userFired'), 'success');
      setShowFireConfirm(false);
      setShowOldChiefDialog(false);
      onSaved();
      onClose();
    } catch (err) {
      showToast(extractErrorMessage(err, t('departments.fireFailed')), 'error');
    } finally {
      setFireSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('departments.chiefTitle', { name: department?.name ?? '' })}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}

          {isLoading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : (
            <>
              <Autocomplete
                label={t('departments.chiefLabel')}
                placeholder={t('departments.chiefSearchPlaceholder')}
                value={selectedUserId}
                onChange={setSelectedUserId}
                fetchOptions={fetchUsers}
              />
              <p className="text-xs text-gray-400">
                {t('departments.chiefHint')}
              </p>
            </>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAssign} isLoading={isSubmitting} disabled={isLoading}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showOldChiefDialog}
        onClose={handleSkipRole}
        title={t('departments.oldChiefTitle')}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {currentChiefName ? (
              <Trans t={t} i18nKey="departments.oldChiefMessage" values={{ name: currentChiefName }} />
            ) : (
              t('departments.oldChiefMessageNoName')
            )}
          </p>

          <Select
            label={t('departments.assignNewRole')}
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
          >
            <option value="">{t('departments.noRole')}</option>
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
              {t('departments.fire')}
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleSkipRole}>
                {t('departments.skip')}
              </Button>
              <Button
                onClick={handleAssignNewRole}
                isLoading={isRoleSubmitting}
                disabled={!newRoleId}
              >
                {t('departments.assignRole')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showFireConfirm}
        onCancel={() => setShowFireConfirm(false)}
        onConfirm={handleFireChief}
        title={t('departments.fireTitle')}
        message={t('departments.fireMessage', { name: currentChiefName })}
        confirmLabel={t('departments.fire')}
        isLoading={fireSubmitting}
      />
    </>
  );
}
