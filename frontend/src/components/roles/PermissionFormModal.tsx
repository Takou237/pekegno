import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { rolesApi } from '@/api/roles.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Permission, PermissionPayload } from '@/types/user';

interface PermissionFormModalProps {
  isOpen: boolean;
  permission: Permission | null; // null = création
  onClose: () => void;
  onSaved: (permission: Permission) => void;
}

export function PermissionFormModal({ isOpen, permission, onClose, onSaved }: PermissionFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = permission !== null;

  const [form, setForm] = useState<PermissionPayload>({ name: '', label: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: permission?.name ?? '',
        label: permission?.label ?? '',
        description: permission?.description ?? '',
      });
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, permission]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const saved = isEditing
        ? await rolesApi.updatePermission(permission.id, form)
        : await rolesApi.createPermission(form);

      showToast(
        isEditing ? t('permissions.updated') : t('permissions.created'),
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('permissions.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('permissions.editTitle') : t('permissions.createTitle')}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label={t('permissions.name')}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t('permissions.namePlaceholder')}
          hint={t('permissions.nameHint')}
          error={fieldErrors.name}
          required
        />

        <Input
          label={t('permissions.label')}
          value={form.label ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          placeholder={t('permissions.labelPlaceholder')}
          error={fieldErrors.label}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('permissions.description')}
          </label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t('permissions.descriptionPlaceholder')}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {fieldErrors.description && (
            <p className="text-sm text-error-500">{fieldErrors.description}</p>
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
