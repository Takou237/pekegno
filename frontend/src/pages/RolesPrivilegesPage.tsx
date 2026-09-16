import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, Pencil, Search, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { rolesApi } from '@/api/roles.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RoleFormModal } from '@/components/roles/RoleFormModal';
import { PermissionFormModal } from '@/components/roles/PermissionFormModal';
import {
  actionLabel,
  domainLabel,
  groupPermissions,
  permissionMatchesQuery,
} from '@/utils/permissionGrouping';
import type { Permission, RoleListItem } from '@/types/user';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];
const PROTECTED_ROLES = ['super-admin', 'direction-generale'];

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

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleListItem | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const [permissionFormOpen, setPermissionFormOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [permissionToDelete, setPermissionToDelete] = useState<Permission | null>(null);
  const [isDeletingPermission, setIsDeletingPermission] = useState(false);

  const fetchRoles = useCallback(async () => {
    const data = await rolesApi.list();
    setRoles(data);
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

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  const groups = useMemo(() => groupPermissions(t, permissions), [permissions, t]);

  const filteredGroups = useMemo(() => {
    const q = query.trim();
    if (!q) return groups;
    return groups
      .map((group) => {
        const domainMatches = domainLabel(t, group.domain).toLowerCase().includes(q.toLowerCase());
        const perms = domainMatches
          ? group.permissions
          : group.permissions.filter((p) => permissionMatchesQuery(p, q));
        return { ...group, permissions: perms };
      })
      .filter((group) => group.permissions.length > 0);
  }, [groups, query, t]);

  function isGroupOpen(domain: string): boolean {
    return query.trim() !== '' || openGroups.has(domain);
  }

  function toggleGroupOpen(domain: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function expandAll() {
    setOpenGroups(new Set(groups.map((g) => g.domain)));
  }

  function collapseAll() {
    setOpenGroups(new Set());
  }

  async function applyRolePermissions(role: RoleListItem, nextIds: string[]) {
    if (!canManage || syncingRoleId) return;
    const nextPermissions = permissions.filter((p) => nextIds.includes(p.id));

    setSyncingRoleId(role.id);
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, permissions: nextPermissions } : r)));

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

  function togglePermission(role: RoleListItem, permissionId: string) {
    const current = role.permissions ?? [];
    const has = current.some((p) => p.id === permissionId);
    const nextIds = has
      ? current.filter((p) => p.id !== permissionId).map((p) => p.id)
      : [...current.map((p) => p.id), permissionId];
    applyRolePermissions(role, nextIds);
  }

  function toggleGroupForRole(role: RoleListItem, groupPerms: Permission[], enable: boolean) {
    const currentIds = (role.permissions ?? []).map((p) => p.id);
    const groupIds = groupPerms.map((p) => p.id);
    const nextIds = enable
      ? Array.from(new Set([...currentIds, ...groupIds]))
      : currentIds.filter((id) => !groupIds.includes(id));
    applyRolePermissions(role, nextIds);
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
    setSelectedRoleId(role.id);
  }

  async function handleDeleteRole() {
    if (!roleToDelete) return;
    setIsDeletingRole(true);
    try {
      await rolesApi.remove(roleToDelete.id);
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
      if (selectedRoleId === roleToDelete.id) setSelectedRoleId(null);
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
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <Shield className="h-5 w-5" />
          {t('privileges.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('privileges.subtitle')}</p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button type="button" className={tabClass(tab === 'roles')} onClick={() => setTab('roles')}>
          {t('privileges.tabsRoles')}
        </button>
        <button type="button" className={tabClass(tab === 'permissions')} onClick={() => setTab('permissions')}>
          {t('privileges.tabsPermissions')}
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <SkeletonTable rows={4} />
      ) : tab === 'roles' ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-col gap-2 lg:w-64 lg:shrink-0">
            {canManage && (
              <Button size="sm" variant="outline" onClick={openCreateRole}>
                <Plus className="h-4 w-4" />
                {t('roles.newRole')}
              </Button>
            )}
            <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
              {roles.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-400">{t('roles.empty')}</p>
              ) : (
                roles.map((role) => {
                  const active = role.id === selectedRoleId;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          active ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {t(`roles.${role.name}`, { defaultValue: role.name })}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t('privileges.groupGranted', {
                          granted: role.permissions?.length ?? 0,
                          total: permissions.length,
                        })}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {!selectedRole ? (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
                {t('privileges.selectRole')}
              </div>
            ) : (
              <RoleDetailPanel
                role={selectedRole}
                canManage={canManage}
                isSyncing={syncingRoleId === selectedRole.id}
                isProtected={PROTECTED_ROLES.includes(selectedRole.name)}
                groups={filteredGroups}
                query={query}
                onQueryChange={setQuery}
                isGroupOpen={isGroupOpen}
                onToggleGroupOpen={toggleGroupOpen}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                onTogglePermission={(permissionId) => togglePermission(selectedRole, permissionId)}
                onToggleGroup={(groupPerms, enable) => toggleGroupForRole(selectedRole, groupPerms, enable)}
                onEdit={() => openEditRole(selectedRole)}
                onDelete={() => setRoleToDelete(selectedRole)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('privileges.searchPlaceholder')}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={expandAll} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                {t('privileges.expandAll')}
              </button>
              <button type="button" onClick={collapseAll} className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400">
                {t('privileges.collapseAll')}
              </button>
              {canManage && (
                <Button size="sm" onClick={openCreatePermission}>
                  <Plus className="h-4 w-4" />
                  {t('permissions.newPermission')}
                </Button>
              )}
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
              {t('privileges.noResults')}
            </div>
          ) : (
            filteredGroups.map((group) => {
              const open = isGroupOpen(group.domain);
              return (
                <div
                  key={group.domain}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupOpen(group.domain)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                      {domainLabel(t, group.domain)}
                    </span>
                    <Badge variant="neutral">{group.permissions.length}</Badge>
                  </button>
                  {open && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                      {group.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                              {actionLabel(t, permission)}
                            </p>
                            <p className="truncate font-mono text-xs text-gray-400">{permission.name}</p>
                            {permission.description && (
                              <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                {permission.description}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <Badge variant="neutral">
                              {t('permissions.colUsage')} : {usedByCount(permission.id)}
                            </Badge>
                            {canManage && (
                              <div className="flex items-center gap-1">
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
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
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

interface RoleDetailPanelProps {
  role: RoleListItem;
  canManage: boolean;
  isSyncing: boolean;
  isProtected: boolean;
  groups: { domain: string; permissions: Permission[] }[];
  query: string;
  onQueryChange: (value: string) => void;
  isGroupOpen: (domain: string) => boolean;
  onToggleGroupOpen: (domain: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onTogglePermission: (permissionId: string) => void;
  onToggleGroup: (groupPerms: Permission[], enable: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RoleDetailPanel({
  role,
  canManage,
  isSyncing,
  isProtected,
  groups,
  query,
  onQueryChange,
  isGroupOpen,
  onToggleGroupOpen,
  onExpandAll,
  onCollapseAll,
  onTogglePermission,
  onToggleGroup,
  onEdit,
  onDelete,
}: RoleDetailPanelProps) {
  const { t } = useTranslation();
  const grantedIds = new Set((role.permissions ?? []).map((p) => p.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t(`roles.${role.name}`, { defaultValue: role.name })}
          </h2>
          {role.description && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{role.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
              title={t('common.edit')}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {!isProtected && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-error-500 dark:hover:bg-gray-800"
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('privileges.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onExpandAll} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            {t('privileges.expandAll')}
          </button>
          <button type="button" onClick={onCollapseAll} className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400">
            {t('privileges.collapseAll')}
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-800">
          {t('privileges.noResults')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const open = isGroupOpen(group.domain);
            const total = group.permissions.length;
            const grantedCount = group.permissions.filter((p) => grantedIds.has(p.id)).length;
            return (
              <div
                key={group.domain}
                className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800"
              >
                <button
                  type="button"
                  onClick={() => onToggleGroupOpen(group.domain)}
                  className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-2.5 text-left dark:bg-gray-800/60"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                    {domainLabel(t, group.domain)}
                  </span>
                  <Badge variant={grantedCount === total ? 'success' : grantedCount === 0 ? 'neutral' : 'brand'}>
                    {grantedCount}/{total}
                  </Badge>
                </button>
                {open && (
                  <div className="flex flex-col gap-2 p-4">
                    {canManage && (
                      <div className="flex justify-end gap-3 text-xs">
                        <button
                          type="button"
                          disabled={isSyncing || grantedCount === total}
                          onClick={() => onToggleGroup(group.permissions, true)}
                          className="font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-brand-400"
                        >
                          {t('privileges.enableAllGroup')}
                        </button>
                        <button
                          type="button"
                          disabled={isSyncing || grantedCount === 0}
                          onClick={() => onToggleGroup(group.permissions, false)}
                          className="font-medium text-gray-500 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-gray-400"
                        >
                          {t('privileges.disableAllGroup')}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const has = grantedIds.has(permission.id);
                        return (
                          <label
                            key={permission.id}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                              canManage && !isSyncing
                                ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60'
                                : 'cursor-default'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={has}
                              disabled={!canManage || isSyncing}
                              onChange={() => onTogglePermission(permission.id)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900"
                            />
                            <span className="text-gray-700 dark:text-gray-200">{actionLabel(t, permission)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
