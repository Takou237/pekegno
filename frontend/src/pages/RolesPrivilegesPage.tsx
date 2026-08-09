import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { rolesApi } from '@/api/roles.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RoleFormModal } from '@/components/roles/RoleFormModal';
import { PermissionFormModal } from '@/components/roles/PermissionFormModal';
import type { Permission, RoleListItem } from '@/types/user';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];
const PROTECTED_ROLES = ['super-admin', 'direction-generale'];

const PERMISSION_KEYS: Record<string, string> = {
  creer: 'privileges.permissionCreate',
  modifier: 'privileges.permissionEdit',
  supprimer: 'privileges.permissionDelete',
  exporter: 'privileges.permissionExport',
  consulter: 'privileges.permissionView',
  imprimer: 'privileges.permissionPrint',
  valider: 'privileges.permissionValidate',
  encaisser: 'privileges.permissionCash',
  annuler: 'privileges.permissionCancel',
};

type Tab = 'roles' | 'permissions';

export default function RolesPrivilegesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canManage = ADMIN_ROLES.includes(user?.role?.name ?? '');

  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingRoleId, setSyncingRoleId] = useState<string | null>(null);

  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleListItem | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const [permissionFormOpen, setPermissionFormOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [permissionToDelete, setPermissionToDelete] = useState<Permission | null>(null);
  const [isDeletingPermission, setIsDeletingPermission] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await rolesApi.list();
      setRoles(data);
    } catch (err) {
      throw err;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        rolesApi.list(),
        rolesApi.listPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err) {
      setError(extractErrorMessage(err, t('privileges.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const permissionSet = (role: RoleListItem): Set<string> =>
    new Set((role.permissions ?? []).map((p) => p.id));

  async function togglePermission(role: RoleListItem, permissionId: string) {
    if (!canManage || syncingRoleId) return;

    const current = role.permissions ?? [];
    const has = current.some((p) => p.id === permissionId);
    const nextIds = has
      ? current.filter((p) => p.id !== permissionId).map((p) => p.id)
      : [...current.map((p) => p.id), permissionId];

    const permission = permissions.find((p) => p.id === permissionId);

    setSyncingRoleId(role.id);
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== role.id) return r;
        if (has) {
          return { ...r, permissions: current.filter((p) => p.id !== permissionId) };
        }
        return {
          ...r,
          permissions: [...current, { id: permissionId, name: permission?.name ?? '', label: permission?.label ?? '', description: permission?.description ?? null }],
        };
      })
    );

    try {
      const saved = await rolesApi.syncPermissions(role.id, nextIds);
      setRoles((prev) => prev.map((r) => (r.id === role.id ? saved : r)));
      showToast(t('privileges.permissionsSaved'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('privileges.assignFailed')), 'error');
      fetchRoles().catch(() => {});
    } finally {
      setSyncingRoleId(null);
    }
  }

  function openCreateRole() {
    setEditingRole(null);
    setRoleFormOpen(true);
  }

  function openEditRole(role: RoleListItem) {
    setEditingRole(role);
    setRoleFormOpen(true);
  }

  function handleRoleSaved(role: RoleListItem) {
    setRoles((prev) => {
      const exists = prev.some((r) => r.id === role.id);
      return exists ? prev.map((r) => (r.id === role.id ? role : r)) : [...prev, role];
    });
  }

  async function handleDeleteRole() {
    if (!roleToDelete) return;
    setIsDeletingRole(true);
    try {
      await rolesApi.remove(roleToDelete.id);
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
      showToast(t('roles.deleted'), 'success');
      setRoleToDelete(null);
    } catch (err) {
      showToast(extractErrorMessage(err, t('roles.deleteFailed')), 'error');
    } finally {
      setIsDeletingRole(false);
    }
  }

  function openCreatePermission() {
    setEditingPermission(null);
    setPermissionFormOpen(true);
  }

  function openEditPermission(permission: Permission) {
    setEditingPermission(permission);
    setPermissionFormOpen(true);
  }

  function handlePermissionSaved(permission: Permission) {
    setPermissions((prev) => {
      const exists = prev.some((p) => p.id === permission.id);
      return exists ? prev.map((p) => (p.id === permission.id ? permission : p)) : [...prev, permission];
    });
    setRoles((prev) =>
      prev.map((r) => ({
        ...r,
        permissions: (r.permissions ?? []).map((p) => (p.id === permission.id ? permission : p)),
      }))
    );
  }

  async function handleDeletePermission() {
    if (!permissionToDelete) return;
    setIsDeletingPermission(true);
    try {
      await rolesApi.deletePermission(permissionToDelete.id);
      setPermissions((prev) => prev.filter((p) => p.id !== permissionToDelete.id));
      setRoles((prev) =>
        prev.map((r) => ({
          ...r,
          permissions: (r.permissions ?? []).filter((p) => p.id !== permissionToDelete.id),
        }))
      );
      showToast(t('permissions.deleted'), 'success');
      setPermissionToDelete(null);
    } catch (err) {
      showToast(extractErrorMessage(err, t('permissions.deleteFailed')), 'error');
    } finally {
      setIsDeletingPermission(false);
    }
  }

  const usedByCount = (permissionId: string): number =>
    roles.filter((r) => (r.permissions ?? []).some((p) => p.id === permissionId)).length;

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
            <Shield className="h-5 w-5" />
            {t('privileges.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('privileges.subtitle')}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {tab === 'roles' ? (
              <Button size="sm" onClick={openCreateRole}>
                <Plus className="h-4 w-4" />
                {t('roles.newRole')}
              </Button>
            ) : (
              <Button size="sm" onClick={openCreatePermission}>
                <Plus className="h-4 w-4" />
                {t('permissions.newPermission')}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button type="button" className={tabClass(tab === 'roles')} onClick={() => setTab('roles')}>
          {t('privileges.tabsRoles')}
        </button>
        <button
          type="button"
          className={tabClass(tab === 'permissions')}
          onClick={() => setTab('permissions')}
        >
          {t('privileges.tabsPermissions')}
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : tab === 'roles' ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left font-medium text-gray-500">
                  {t('privileges.colRole')}
                </th>
                {permissions.map((permission) => {
                  const action = permission.name.split('.').pop() ?? '';
                  const label = t(PERMISSION_KEYS[action] ?? '', {
                    defaultValue: permission.name,
                  });
                  return (
                    <th key={permission.id} className="px-3 py-3 text-center font-medium text-gray-500">
                      <span className="text-xs uppercase">{label}</span>
                    </th>
                  );
                })}
                {canManage && (
                  <th className="px-5 py-3 text-right font-medium text-gray-500">
                    {t('common.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {roles.length === 0 ? (
                <tr>
                  <td
                    colSpan={permissions.length + (canManage ? 2 : 1)}
                    className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {t('roles.empty')}
                  </td>
                </tr>
              ) : (
                roles.map((role) => {
                  const perms = permissionSet(role);
                  const isProtected = PROTECTED_ROLES.includes(role.name);
                  const isSyncing = syncingRoleId === role.id;
                  return (
                    <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {t(`roles.${role.name}`, { defaultValue: role.name })}
                        </div>
                        {role.description && (
                          <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                            {role.description}
                          </div>
                        )}
                      </td>
                      {permissions.map((permission) => {
                        const has = perms.has(permission.id);
                        return (
                          <td key={permission.id} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              disabled={!canManage || isSyncing}
                              onClick={() => togglePermission(role, permission.id)}
                              title={has ? t('privileges.permissionRemove') : t('privileges.permissionGrant')}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
                              aria-pressed={has}
                            >
                              {has ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                  ✓
                                </span>
                              ) : (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-300 dark:border-gray-700 dark:text-gray-600">
                                  +
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditRole(role)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {!isProtected && (
                              <button
                                type="button"
                                onClick={() => setRoleToDelete(role)}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-error-500 dark:hover:bg-gray-800"
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('permissions.colLabel')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('permissions.colName')}</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('permissions.colDescription')}</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">{t('permissions.colUsage')}</th>
                {canManage && (
                  <th className="px-5 py-3 text-right font-medium text-gray-500">{t('common.actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {permissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 5 : 4}
                    className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {t('permissions.empty')}
                  </td>
                </tr>
              ) : (
                permissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {permission.label || permission.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {permission.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {permission.description ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-300">
                      {usedByCount(permission.id)}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditPermission(permission)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPermissionToDelete(permission)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-error-500 dark:hover:bg-gray-800"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <RoleFormModal
        isOpen={roleFormOpen}
        role={editingRole}
        permissions={permissions}
        onClose={() => setRoleFormOpen(false)}
        onSaved={handleRoleSaved}
      />

      <PermissionFormModal
        isOpen={permissionFormOpen}
        permission={editingPermission}
        onClose={() => setPermissionFormOpen(false)}
        onSaved={handlePermissionSaved}
      />

      <ConfirmDialog
        isOpen={roleToDelete !== null}
        title={t('roles.deleteTitle')}
        message={t('roles.deleteMessage', { name: roleToDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        isLoading={isDeletingRole}
        onConfirm={handleDeleteRole}
        onCancel={() => setRoleToDelete(null)}
      />

      <ConfirmDialog
        isOpen={permissionToDelete !== null}
        title={t('permissions.deleteTitle')}
        message={t('permissions.deleteMessage', { name: permissionToDelete?.label || permissionToDelete?.name || '' })}
        confirmLabel={t('common.delete')}
        isLoading={isDeletingPermission}
        onConfirm={handleDeletePermission}
        onCancel={() => setPermissionToDelete(null)}
      />
    </div>
  );
}
