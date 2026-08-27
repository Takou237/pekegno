import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Trainer } from '@/api/academy.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import type { CourseModule, CourseModulePayload } from '@/types/formation';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

interface FormState {
  name: string;
  description: string;
  duration_hours: string;
  trainer_id: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  duration_hours: '',
  trainer_id: '',
};

export default function CourseModulesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { courseId } = useParams<{ courseId: string }>();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [modules, setModules] = useState<CourseModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourseModule | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fetchModules = useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await academyApi.modules(courseId);
      setModules(data);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const trainerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const response = await academyApi.trainers({
        agency_id: agencyId,
        search: query.trim() || undefined,
        per_page: 20,
      });
      return response.data.map((trainer: Trainer) => ({
        id: trainer.id,
        label: [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email || '—',
        subtitle: trainer.email ?? undefined,
      }));
    },
    [agencyId],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(mod: CourseModule) {
    setEditing(mod);
    setForm({
      name: mod.name,
      description: mod.description ?? '',
      duration_hours: mod.duration_hours != null ? String(mod.duration_hours) : '',
      trainer_id: mod.trainer_id ?? '',
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!courseId) return;
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: CourseModulePayload = {
      name: form.name,
      description: form.description || undefined,
      duration_hours: form.duration_hours ? Number(form.duration_hours) : undefined,
      trainer_id: form.trainer_id || undefined,
    };

    try {
      if (editing) {
        const saved = await academyApi.updateModule(courseId, editing.id, payload);
        setModules((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
      } else {
        payload.order_index = modules.length;
        const saved = await academyApi.createModule(courseId, payload);
        setModules((prev) => [...prev, saved]);
      }
      showToast(t('academy.saved'), 'success');
      setFormOpen(false);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(mod: CourseModule) {
    if (!courseId) return;
    if (!window.confirm(t('academy.deleteModuleConfirm', { name: mod.name }))) return;
    try {
      await academyApi.removeModule(courseId, mod.id);
      setModules((prev) => prev.filter((m) => m.id !== mod.id));
      showToast(t('academy.moduleDeleted'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  async function handleMoveUp(index: number) {
    if (!courseId || index === 0) return;
    const reordered = [...modules];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    const order = reordered.map((m) => m.id);
    try {
      const saved = await academyApi.reorderModules(courseId, order);
      setModules(saved);
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.saveFailed')), 'error');
    }
  }

  async function handleMoveDown(index: number) {
    if (!courseId || index === modules.length - 1) return;
    const reordered = [...modules];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    const order = reordered.map((m) => m.id);
    try {
      const saved = await academyApi.reorderModules(courseId, order);
      setModules(saved);
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.saveFailed')), 'error');
    }
  }

  function trainerName(mod: CourseModule): string {
    if (!mod.trainer) return '—';
    return [mod.trainer.first_name, mod.trainer.last_name].filter(Boolean).join(' ') || '—';
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('academy.modules')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.modulesSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('academy.newModule')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : modules.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noModules')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-3 font-medium" />
                  <th className="px-5 py-3 font-medium">{t('common.order')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.name')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.trainers')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.duration')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {modules.map((mod, index) => (
                  <tr key={mod.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-3">
                      <GripVertical className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {mod.order_index + 1}
                        </span>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                            title={t('common.moveUp')}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === modules.length - 1}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                            title={t('common.moveDown')}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{mod.name}</span>
                      {mod.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
                          {mod.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{trainerName(mod)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {mod.duration_hours != null ? (
                        <Badge variant="brand">
                          {mod.duration_hours} {t('academy.hours')}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(mod)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(mod)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('academy.editModule') : t('academy.newModule')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          <Input
            label={`${t('common.name')} *`}
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            error={fieldErrors.name}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <Input
            label={t('academy.duration')}
            type="number"
            min="0"
            step="0.5"
            value={form.duration_hours}
            onChange={(e) => setForm((prev) => ({ ...prev, duration_hours: e.target.value }))}
            error={fieldErrors.duration_hours}
          />

          <Autocomplete
            label={t('nav.trainers')}
            placeholder={t('academy.searchTrainerPlaceholder')}
            value={form.trainer_id}
            onChange={(trainerId) => setForm((prev) => ({ ...prev, trainer_id: trainerId }))}
            fetchOptions={trainerOptions}
            error={fieldErrors.trainer_id}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
