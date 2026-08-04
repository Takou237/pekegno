import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, ShieldCheck, Trash2, ChevronRight } from 'lucide-react';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AgencyFormModal } from '@/components/agencies/AgencyFormModal';
import { AgencyChiefAssignModal } from '@/components/agencies/AgencyChiefAssignModal';
import { canAssignAgencyChief, canDeleteAgency, canEditAgency } from '@/utils/agencyPermissions';
import type { Agency } from '@/types/agency';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
  refreshAgency?: () => void;
}

export default function AgencySettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { agency, refreshAgency } = useOutletContext<AgencyLayoutContext>();

  const [editOpen, setEditOpen] = useState(false);
  const [chiefOpen, setChiefOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!agency) {
    return <p className="text-sm text-error-500">{t('agencies.empty')}</p>;
  }

  async function handleDelete() {
    if (!agency) return;
    setIsDeleting(true);
    try {
      await agenciesApi.remove(agency.id);
      showToast(t('agencies.archived'), 'success');
      setDeleteOpen(false);
      navigate('/agencies');
    } catch (error) {
      showToast(extractErrorMessage(error, t('agencies.deleteFailed')), 'error');
      setDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  const actions: { key: string; icon: typeof Pencil; label: string; description: string; onClick: () => void; danger?: boolean }[] = [];

  if (canAssignAgencyChief(user)) {
    actions.push({
      key: 'chief',
      icon: ShieldCheck,
      label: t('agencies.assignChief'),
      description: t('agencies.settingsAssignChiefDesc'),
      onClick: () => setChiefOpen(true),
    });
  }

  if (canEditAgency(user)) {
    actions.push({
      key: 'edit',
      icon: Pencil,
      label: t('agencies.settingsEditAgency'),
      description: t('agencies.settingsEditAgencyDesc'),
      onClick: () => setEditOpen(true),
    });
  }

  if (canDeleteAgency(user)) {
    actions.push({
      key: 'delete',
      icon: Trash2,
      label: t('agencies.settingsArchiveAgency'),
      description: t('agencies.settingsArchiveAgencyDesc'),
      onClick: () => setDeleteOpen(true),
      danger: true,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('agencies.settingsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencies.settingsSubtitle')}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {actions.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('agencies.settingsNoActions')}</p>
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

      <AgencyFormModal
        isOpen={editOpen}
        agency={agency}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          refreshAgency?.();
        }}
      />

      <AgencyChiefAssignModal
        isOpen={chiefOpen}
        agency={agency}
        onClose={() => setChiefOpen(false)}
        onSaved={() => {
          setChiefOpen(false);
          refreshAgency?.();
        }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title={t('agencies.archiveTitle')}
        message={t('agencies.archiveMessage', { name: agency.name })}
        confirmLabel={t('agencies.archive')}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
