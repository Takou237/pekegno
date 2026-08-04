import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { rolesApi } from '@/api/roles.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Permission, RoleListItem, RolePayload } from '@/types/user';

interface RoleFormModalProps {
  isOpen: boolean;
  role: RoleListItem | null; // null = création
  permissions: Permission[];
  onClose: () => void;
  onSaved: (role: RoleListItem) => void;
}

export function RoleFormModal({ isOpen, role, permissions, onClose, onSaved }: RoleFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = role !== null;

  const [form, setForm] = useState<RolePayload>({ name: '', description: '' });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: role?.name ?? '',
        description: role?.description ?? '',
      });
      setSelectedPermissions((role?.permissions ?? []).map((p) => p.id));
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, role]);

  function togglePermission(permissionId: string) {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: RolePayload = {
      ...form,
      permissions: selectedPermissions,
    };

    try {
      const saved = isEditing
        ? await rolesApi.update(role.id, payload)
        : await rolesApi.create(payload);

      showToast(
        isEditing ? t('roles.updated') : t('roles.created'),
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('roles.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('roles.editTitle') : t('roles.createTitle')}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label={t('roles.name')}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t('roles.namePlaceholder')}
          error={fieldErrors.name}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('roles.description')}
          </label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t('roles.descriptionPlaceholder')}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {fieldErrors.description && (
            <p className="text-sm text-error-500">{fieldErrors.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('roles.permissions')}
          </span>
          {permissions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('roles.noPermissions')}</p>
          ) : (
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              {permissions.map((permission) => (
                <label
                  key={permission.id}
                  className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900"
                  />
                  {permission.label || permission.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {isEditing ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
