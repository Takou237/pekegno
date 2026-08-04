import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { modulesApi } from '@/api/modules.api';
import { usersApi } from '@/api/users.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Module, ModulePayload, ModuleType } from '@/types/module';
import type { UserListItem } from '@/types/user';

const MODULE_TYPES: ModuleType[] = ['video', 'pdf', 'cours', 'exercice', 'quiz'];

interface ModuleFormState {
  name: string;
  type: ModuleType;
  trainer_id: string;
  description: string;
  cover_image: string | null;
  video: string;
  pdf: string;
}

function emptyForm(): ModuleFormState {
  return {
    name: '',
    type: 'cours',
    trainer_id: '',
    description: '',
    cover_image: null,
    video: '',
    pdf: '',
  };
}

interface ModuleFormModalProps {
  isOpen: boolean;
  formationId: string;
  module: Module | null; // null = création
  onClose: () => void;
  onSaved: () => void;
}

export function ModuleFormModal({ isOpen, formationId, module, onClose, onSaved }: ModuleFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = module !== null;

  const [form, setForm] = useState<ModuleFormState>(emptyForm());
  const [trainers, setTrainers] = useState<UserListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(
        module
          ? {
              name: module.name,
              type: module.type,
              trainer_id: module.trainer_id ?? '',
              description: module.description ?? '',
              cover_image: module.cover_image,
              video: module.video ?? '',
              pdf: module.pdf ?? '',
            }
          : emptyForm()
      );
      setFormError(null);
      setFieldErrors({});
      usersApi
        .list({ per_page: 100 })
        .then((r) => setTrainers(r.data.filter((u) => u.role?.name === 'formateur')))
        .catch(() => {});
    }
  }, [isOpen, module]);

  function update<K extends keyof ModuleFormState>(field: K, value: ModuleFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadsApi.upload(file);
      update('cover_image', result.url);
    } catch (error) {
      showToast(extractErrorMessage(error, t('modules.uploadFailed')), 'error');
    } finally {
      setIsUploading(false);
    }
  }

  function buildPayload(): ModulePayload {
    return {
      formation_id: formationId,
      name: form.name.trim(),
      type: form.type,
      trainer_id: form.trainer_id || null,
      description: form.description.trim() || null,
      cover_image: form.cover_image,
      video: form.video.trim() || null,
      pdf: form.pdf.trim() || null,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildPayload();
      if (isEditing) {
        const { formation_id: _formationId, ...rest } = payload;
        await modulesApi.update(module.id, rest);
      } else {
        await modulesApi.create(payload);
      }

      showToast(isEditing ? t('modules.updated') : t('modules.saved'), 'success');
      onSaved();
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('modules.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('modules.editTitle') : t('modules.createTitle')}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('modules.name')}
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={fieldErrors.name}
            placeholder={t('modules.namePlaceholder')}
          />
          <Select
            label={t('modules.type')}
            value={form.type}
            onChange={(e) => update('type', e.target.value as ModuleType)}
          >
            {MODULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`modules.types.${type}`)}
              </option>
            ))}
          </Select>
        </div>

        <Select
          label={t('modules.trainer')}
          value={form.trainer_id}
          onChange={(e) => update('trainer_id', e.target.value)}
        >
          <option value="">{t('modules.noTrainer')}</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('modules.description')}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={2}
            placeholder={t('modules.descriptionPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('modules.video')}
            value={form.video}
            onChange={(e) => update('video', e.target.value)}
            error={fieldErrors.video}
            placeholder="https://..."
          />
          <Input
            label={t('modules.pdf')}
            value={form.pdf}
            onChange={(e) => update('pdf', e.target.value)}
            error={fieldErrors.pdf}
            placeholder="https://..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('modules.coverImage')}
          </label>
          {form.cover_image && (
            <div className="relative w-40 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <img src={form.cover_image} alt={form.name} className="h-24 w-full object-cover" />
              <button
                type="button"
                onClick={() => update('cover_image', null)}
                className="absolute right-1 top-1 rounded-lg bg-gray-900/70 p-1 text-white hover:bg-gray-900"
                title={t('modules.removeCover')}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
            {isUploading ? t('modules.uploading') : t('modules.uploadCover')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                handleCoverUpload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <div className="w-32">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          </div>
          <div className="w-40">
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
