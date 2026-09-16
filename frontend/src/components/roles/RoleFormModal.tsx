import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Search } from 'lucide-react';
import { rolesApi } from '@/api/roles.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { actionLabel, domainLabel, groupPermissions, permissionMatchesQuery } from '@/utils/permissionGrouping';
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
  const [permQuery, setPermQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const groups = useMemo(() => groupPermissions(t, permissions), [permissions, t]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: role?.name ?? '',
        description: role?.description ?? '',
      });
      const selected = (role?.permissions ?? []).map((p) => p.id);
      setSelectedPermissions(selected);
      // On ouvre d'office les groupes qui ont déjà des permissions accordées,
      // pour que l'utilisateur voie tout de suite ce qui est actif sans devoir
      // déplier les ~35 groupes un par un.
      const selectedSet = new Set(selected);
      setOpenGroups(
        new Set(groupPermissions(t, permissions).filter((g) => g.permissions.some((p) => selectedSet.has(p.id))).map((g) => g.domain))
      );
      setPermQuery('');
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, role, permissions, t]);

  const filteredGroups = useMemo(() => {
    const q = permQuery.trim();
    if (!q) return groups;
    return groups
      .map((group) => {
        const domainMatches = domainLabel(t, group.domain).toLowerCase().includes(q.toLowerCase());
        const perms = domainMatches ? group.permissions : group.permissions.filter((p) => permissionMatchesQuery(p, q));
        return { ...group, permissions: perms };
      })
      .filter((group) => group.permissions.length > 0);
  }, [groups, permQuery, t]);

  function isGroupOpen(domain: string): boolean {
    return permQuery.trim() !== '' || openGroups.has(domain);
  }

  function toggleGroupOpen(domain: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

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
            <div className="flex flex-col gap-2 rounded-lg border border-gray-100 p-2 dark:border-gray-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={permQuery}
                  onChange={(e) => setPermQuery(e.target.value)}
                  placeholder={t('privileges.searchPlaceholder')}
                  className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {filteredGroups.map((group) => {
                  const open = isGroupOpen(group.domain);
                  const grantedCount = group.permissions.filter((p) => selectedPermissions.includes(p.id)).length;
                  return (
                    <div key={group.domain} className="rounded-lg border border-gray-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => toggleGroupOpen(group.domain)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-200"
                      >
                        <span className="flex items-center gap-1.5">
                          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                          {domainLabel(t, group.domain)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {grantedCount}/{group.permissions.length}
                        </span>
                      </button>
                      {open && (
                        <div className="grid grid-cols-1 gap-1 border-t border-gray-100 p-2 sm:grid-cols-2 dark:border-gray-800">
                          {group.permissions.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1 text-sm text-gray-600 dark:text-gray-300"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900"
                              />
                              {actionLabel(t, permission)}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
