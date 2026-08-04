import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Video,
  FileText,
  BookOpen,
  ListChecks,
  HelpCircle,
} from 'lucide-react';
import { formationsApi } from '@/api/formations.api';
import { modulesApi } from '@/api/modules.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ModuleFormModal } from '@/components/formations/ModuleFormModal';
import { FormationFormModal } from '@/components/formations/FormationFormModal';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Formation } from '@/types/formation';
import type { Module, ModuleType } from '@/types/module';
import type { Service } from '@/types/service';

const MODULE_ICONS: Record<ModuleType, typeof Video> = {
  video: Video,
  pdf: FileText,
  cours: BookOpen,
  exercice: ListChecks,
  quiz: HelpCircle,
};

interface FormationDetailModalProps {
  formationId: string | null;
  initial?: Formation | null;
  onClose: () => void;
  onChanged: () => void;
}

export function FormationDetailModal({ formationId, initial, onClose, onChanged }: FormationDetailModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [formation, setFormation] = useState<Formation | null>(initial ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moduleModal, setModuleModal] = useState<{ open: boolean; module: Module | null }>({
    open: false,
    module: null,
  });
  const [deleteModule, setDeleteModule] = useState<Module | null>(null);
  const [isDeletingModule, setIsDeletingModule] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isFormEdit, setIsFormEdit] = useState(false);

  const loadFormation = useCallback(async (id: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await formationsApi.get(id);
      setFormation(data);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('formations.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (formationId) loadFormation(formationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formationId]);

  async function handleMoveModule(module: Module, direction: -1 | 1) {
    if (!formation?.modules) return;
    const modules = [...formation.modules];
    const index = modules.findIndex((item) => item.id === module.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= modules.length) return;

    [modules[index], modules[target]] = [modules[target], modules[index]];
    setFormation({ ...formation, modules });

    setIsReordering(true);
    try {
      const reordered = await modulesApi.reorder({
        order: modules.map((item) => item.id),
      });
      setFormation((prev) => (prev ? { ...prev, modules: reordered } : prev));
      onChanged();
    } catch (error) {
      showToast(extractErrorMessage(error, t('modules.reorderFailed')), 'error');
      if (formationId) loadFormation(formationId);
    } finally {
      setIsReordering(false);
    }
  }

  async function handleDeleteModule() {
    if (!deleteModule) return;
    setIsDeletingModule(true);
    try {
      await modulesApi.remove(deleteModule.id);
      showToast(t('modules.deleted'), 'success');
      setDeleteModule(null);
      if (formationId) loadFormation(formationId);
      onChanged();
    } catch (error) {
      showToast(extractErrorMessage(error, t('modules.deleteFailed')), 'error');
    } finally {
      setIsDeletingModule(false);
    }
  }

  function handleFormSaved() {
    setIsFormEdit(false);
    if (formationId) loadFormation(formationId);
    onChanged();
  }

  function formatPrice(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.NumberFormat(currentLocale(), {
      style: 'currency',
      currency: 'XAF',
      maximumFractionDigits: 0,
    }).format(Number(value));
  }

  const service: Service | null = formation?.service ?? null;

  return (
    <>
      <Modal
        isOpen={Boolean(formationId)}
        onClose={onClose}
        title={t('formations.detailTitle')}
        maxWidth="max-w-3xl"
      >
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="text-sm text-error-500">{loadError}</p>
        ) : formation ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                {service?.cover_image ? (
                  <img
                    src={service.cover_image}
                    alt={service?.name ?? ''}
                    className="h-20 w-20 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700"
                    style={{ backgroundColor: service?.category?.color ?? '#CBD5E1' }}
                  >
                    <CategoryIcon name={service?.category?.icon} className="h-9 w-9 text-white" />
                  </div>
                )}
                <div className="flex flex-col justify-center gap-1.5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {service?.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {service?.category && <Badge variant="brand">{service.category.name}</Badge>}
                    {formation.type === 'presentiel' ? (
                      <Badge variant="success">{t('formations.presentiel')}</Badge>
                    ) : (
                      <Badge variant="brand">{t('formations.distanciel')}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={() => setIsFormEdit(true)}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('services.price')}</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {formatPrice(service?.effective_price ?? service?.price)}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('formations.duration')}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {formation.duration ?? '—'}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('formations.depositAmount')}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {formatPrice(formation.deposit_amount)}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('formations.installmentsCount')}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                  {formation.installments_count ?? '—'}
                </dd>
              </div>
            </div>

            {formation.conditions && (
              <div>
                <dt className="text-xs uppercase text-gray-400">{t('formations.conditions')}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                  {formation.conditions}
                </dd>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t('formations.modules')} ({formation.modules?.length ?? 0})
                </h4>
                <Button onClick={() => setModuleModal({ open: true, module: null })}>
                  <Plus className="h-4 w-4" />
                  {t('modules.newModule')}
                </Button>
              </div>

              {formation.modules && formation.modules.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {formation.modules.map((module, index) => {
                    const Icon = MODULE_ICONS[module.type] ?? BookOpen;
                    return (
                      <div
                        key={module.id}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800"
                      >
                        <span className="w-6 text-center text-sm font-semibold text-gray-400">
                          {index + 1}
                        </span>
                        <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {module.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {t(`modules.types.${module.type}`)}
                            {module.trainer?.name ? ` · ${module.trainer.name}` : ''}
                            {module.video ? ` · ${t('modules.hasVideo')}` : ''}
                            {module.pdf ? ` · ${t('modules.hasPdf')}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveModule(module, -1)}
                            disabled={index === 0 || isReordering}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-800"
                            title={t('modules.moveUp')}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveModule(module, 1)}
                            disabled={index === (formation.modules?.length ?? 1) - 1 || isReordering}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-800"
                            title={t('modules.moveDown')}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setModuleModal({ open: true, module })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteModule(module)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('modules.empty')}</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ModuleFormModal
        isOpen={moduleModal.open}
        formationId={formationId ?? ''}
        module={moduleModal.module}
        onClose={() => setModuleModal({ open: false, module: null })}
        onSaved={() => {
          if (formationId) loadFormation(formationId);
          onChanged();
        }}
      />

      <FormationFormModal
        isOpen={isFormEdit}
        formation={formation}
        services={[]}
        onClose={() => setIsFormEdit(false)}
        onSaved={handleFormSaved}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteModule)}
        title={t('modules.deleteTitle')}
        message={t('modules.deleteMessage', { name: deleteModule?.name ?? '' })}
        confirmLabel={t('modules.delete')}
        isLoading={isDeletingModule}
        onConfirm={handleDeleteModule}
        onCancel={() => setDeleteModule(null)}
      />
    </>
  );
}
