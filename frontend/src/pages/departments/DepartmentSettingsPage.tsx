import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, ShieldCheck, Trash2, ChevronRight } from 'lucide-react';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DepartmentFormModal } from '@/components/departments/DepartmentFormModal';
import { DepartmentChiefAssignModal } from '@/components/departments/DepartmentChiefAssignModal';
import { canDeleteDepartment, canEditDepartment } from '@/utils/departmentPermissions';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department: Department | null;
  departmentId?: string;
  refreshDepartment?: () => void;
}

export default function DepartmentSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { department, refreshDepartment } = useOutletContext<DepartmentLayoutContext>();

  const [editOpen, setEditOpen] = useState(false);
  const [chiefOpen, setChiefOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!department) {
    return <p className="text-sm text-error-500">{t('departments.empty')}</p>;
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await departmentsApi.remove(department!.id);
      showToast(t('departments.archived'), 'success');
      setDeleteOpen(false);
      navigate(department!.agency_id ? `/agencies/${department!.agency_id}/departments` : '/departments');
    } catch (error) {
      showToast(extractErrorMessage(error, t('departments.deleteFailed')), 'error');
      setDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  const actions: { key: string; icon: typeof Pencil; label: string; description: string; onClick: () => void; danger?: boolean }[] = [];

  if (canEditDepartment(user)) {
    actions.push({
      key: 'edit',
      icon: Pencil,
      label: t('departments.settingsEditDepartment'),
      description: t('departments.settingsEditDepartmentDesc'),
      onClick: () => setEditOpen(true),
    });
    actions.push({
      key: 'chief',
      icon: ShieldCheck,
      label: t('departments.assignChief'),
      description: t('departments.settingsChiefDesc'),
      onClick: () => setChiefOpen(true),
    });
  }

  if (canDeleteDepartment(user)) {
    actions.push({
      key: 'delete',
      icon: Trash2,
      label: t('departments.settingsArchiveDepartment'),
      description: t('departments.settingsArchiveDepartmentDesc'),
      onClick: () => setDeleteOpen(true),
      danger: true,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('departments.settingsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('departments.settingsSubtitle')}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {actions.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('departments.settingsNoActions')}</p>
        ) : (
          actions.map(({ key, icon: Icon, label, description, onClick, danger }, index) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className={`flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                index > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  danger
                    ? 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400'
                    : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-semibold ${
                    danger
                      ? 'text-error-600 dark:text-error-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {label}
                </span>
                <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          ))
        )}
      </div>

      <DepartmentFormModal
        isOpen={editOpen}
        department={department}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          refreshDepartment?.();
        }}
      />

      <DepartmentChiefAssignModal
        isOpen={chiefOpen}
        department={department}
        onClose={() => setChiefOpen(false)}
        onSaved={() => {
          setChiefOpen(false);
          refreshDepartment?.();
        }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title={t('departments.archiveTitle')}
        message={t('departments.archiveMessage', { name: department.name })}
        confirmLabel={t('departments.archive')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
