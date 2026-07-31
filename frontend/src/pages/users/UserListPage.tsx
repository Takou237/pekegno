import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Pencil, Eye, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usersApi } from '@/api/users.api';
import { agenciesApi } from '@/api/agencies.api';
import { departmentsApi } from '@/api/departments.api';
import { client } from '@/api/client';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { CreateUserPayload, UserListItem, RoleListItem } from '@/types/user';
import type { Agency, AssignedUser, Department, PaginationMeta } from '@/types/agency';
import { assignableRoleNames, CHIEF_ROLE_NAMES } from '@/utils/employeeRoles';

export default function UserListPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const selectedAgencyId = searchParams.get('agency_id') ?? '';
  const selectedDepartmentId = searchParams.get('department_id') ?? '';

  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role_id: '',
    is_active: true,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [viewUser, setViewUser] = useState<UserListItem | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetType, setAssignTargetType] = useState<'agency' | 'department' | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserListItem[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [confirmRoleRemove, setConfirmRoleRemove] = useState<(() => Promise<void>) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    username: '',
    email: '',
    password: 'password',
    password_confirmation: 'password',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const canManageUsers = ['super-admin', 'direction-generale'].includes(
    currentUser?.role?.name ?? ''
  );

  const canCreateUsers = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchUsers = useCallback(async (filters: {
    search?: string;
    agency_id?: string;
    department_id?: string;
    page: number;
  }) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await usersApi.list({
        search: filters.search || undefined,
        agency_id: filters.agency_id || undefined,
        department_id: filters.department_id || undefined,
        page: filters.page,
        per_page: 15,
      });
      setUsers(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, 'Impossible de charger les utilisateurs.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchParams = useMemo(() => ({
    search: search || undefined,
    agency_id: selectedAgencyId || undefined,
    department_id: selectedDepartmentId || undefined,
    page,
  }), [search, selectedAgencyId, selectedDepartmentId, page]);

  useEffect(() => {
    fetchUsers(fetchParams);
  }, [fetchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    usersApi.listRoles().then(setRoles).catch(() => {});
  }, []);

  const assignableRoles = roles.filter(
    (r) =>
      !CHIEF_ROLE_NAMES.has(r.name) &&
      assignableRoleNames(currentUser?.role?.name).includes(r.name)
  );

  function handleAgencyChange(agencyId: string) {
    const agency = agencies.find((a) => a.id === agencyId);
    setDepartments(agency?.departments ?? []);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (agencyId) params.set('agency_id', agencyId);
    else params.delete('agency_id');
    params.delete('department_id');
    setSearchParams(params);
  }

  function handleDepartmentChange(departmentId: string) {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (departmentId) params.set('department_id', departmentId);
    else params.delete('department_id');
    setSearchParams(params);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  useEffect(() => {
    agenciesApi.list({ per_page: 100, with: 'departments' }).then((res) => {
      setAgencies(res.data ?? []);
    }).catch(() => {});
  }, []);

  // Quand on arrive avec ?department_id=xxx sans ?agency_id, on déduit l'agence
  useEffect(() => {
    if (selectedDepartmentId && !selectedAgencyId && agencies.length > 0) {
      const found = agencies.find((a) =>
        a.departments?.some((d) => d.id === selectedDepartmentId)
      );
      if (found) {
        const params = new URLSearchParams(searchParams);
        params.set('agency_id', found.id);
        setSearchParams(params);
      }
    }
  }, [selectedDepartmentId, selectedAgencyId, agencies]);

  useEffect(() => {
    if (selectedAgencyId) {
      const agency = agencies.find((a) => a.id === selectedAgencyId);
      setDepartments(agency?.departments ?? []);
    } else if (currentUser?.role?.name === 'responsable-departement') {
      departmentsApi.list({ per_page: 100 }).then((res) => setDepartments(res.data)).catch(() => {});
    } else {
      setDepartments([]);
    }
  }, [selectedAgencyId, agencies, currentUser]);

  function openEdit(user: UserListItem) {
    setEditUser(user);
    setEditForm({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email,
      phone: user.phone ?? '',
      role_id: user.role_id ?? '',
      is_active: user.is_active,
    });
    setEditErrors({});
  }

  function handleEditSubmitConfirm() {
    if (!editForm.role_id) {
      setConfirmRoleRemove(() => async () => {
        setConfirmRoleRemove(null);
        await submitEdit();
      });
      return;
    }
    submitEdit();
  }

  async function submitEdit() {
    if (!editUser) return;
    setEditSubmitting(true);
    setEditErrors({});
    try {
      await usersApi.update(editUser.id, editForm);
      showToast('Utilisateur modifié avec succès.', 'success');
      setEditUser(null);
      fetchUsers(fetchParams);
    } catch (error) {
      setEditErrors(
        Object.fromEntries(
          Object.entries(
            (error as any).response?.data?.errors ?? {}
          ).map(([k, v]: [string, any]) => [k, v[0]])
        )
      );
    } finally {
      setEditSubmitting(false);
    }
  }

  const NON_ASSIGNABLE_ROLES = new Set(['super-admin', 'direction-generale', 'client']);

  function openAssignModal(type: 'agency' | 'department') {
    setAssignTargetType(type);
    setAssignModalOpen(true);
    setAssignLoading(true);
    setAssignError(null);

    if (type === 'agency') {
      client.get(`/agencies/${selectedAgencyId}`)
        .then((agencyRes) => {
          const data = agencyRes.data.data ?? agencyRes.data;
          setAssignedUsers(data.assigned_users ?? []);

          const assignedIds = new Set((data.assigned_users ?? []).map((u: any) => u.id));
          return client.get('/users', { params: { per_page: 100 } }).then((usersRes) => {
            const available: UserListItem[] = (usersRes.data.data ?? usersRes.data).filter(
              (u: UserListItem) =>
                !assignedIds.has(u.id) &&
                !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
            );
            setAvailableUsers(available);
          });
        })
        .catch(() => setAssignError('Impossible de charger les données.'))
        .finally(() => setAssignLoading(false));
    } else {
      const dept = departments.find((d) => d.id === selectedDepartmentId);
      if (!dept) { setAssignLoading(false); return; }

      Promise.all([
        client.get(`/agencies/${dept.agency_id}`),
        client.get(`/departments/${selectedDepartmentId}/users`),
      ])
        .then(([agencyRes, deptRes]) => {
          const agencyData = agencyRes.data.data ?? agencyRes.data;
          const agencyUsers: AssignedUser[] = agencyData.assigned_users ?? [];
          const deptUsersRaw: any[] = deptRes.data.data ?? deptRes.data;
          const deptUserIds = new Set(deptUsersRaw.map((u: any) => u.id));

          setAssignedUsers(deptUsersRaw.map((u: any) => ({ ...u, pivot: u.pivot ?? null })));

          const available: UserListItem[] = agencyUsers.filter(
            (u: AssignedUser) =>
              !deptUserIds.has(u.id) &&
              !NON_ASSIGNABLE_ROLES.has((u as any).role?.name ?? '')
          );
          setAvailableUsers(available as UserListItem[]);
        })
        .catch(() => setAssignError('Impossible de charger les données.'))
        .finally(() => setAssignLoading(false));
    }
  }

  async function handleAssignUser(userId: string) {
    const targetId = assignTargetType === 'agency' ? selectedAgencyId : selectedDepartmentId;
    if (!targetId) return;
    const endpoint = assignTargetType === 'agency' ? `/agencies/${targetId}/users` : `/departments/${targetId}/users`;

    try {
      await client.post(endpoint, { user_id: userId });
      showToast('Utilisateur assigné avec succès.', 'success');
      fetchUsers(fetchParams);
      await reloadAssignData();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Impossible d\'assigner l\'utilisateur.'), 'error');
      setAssignError(extractErrorMessage(err, 'Erreur'));
    }
  }

  async function handleRemoveUser(userId: string) {
    const targetId = assignTargetType === 'agency' ? selectedAgencyId : selectedDepartmentId;
    if (!targetId) return;
    const endpoint = assignTargetType === 'agency'
      ? `/agencies/${targetId}/users/${userId}`
      : `/departments/${targetId}/users/${userId}`;

    try {
      await client.delete(endpoint);
      showToast('Utilisateur retiré avec succès.', 'success');
      fetchUsers(fetchParams);
      await reloadAssignData();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Impossible de retirer l\'utilisateur.'), 'error');
    }
  }

  async function reloadAssignData() {
    if (assignTargetType === 'agency') {
      if (!selectedAgencyId) return;
      try {
        const [agencyRes, usersRes] = await Promise.all([
          client.get(`/agencies/${selectedAgencyId}`),
          client.get('/users', { params: { per_page: 100 } }),
        ]);
        const data = agencyRes.data.data ?? agencyRes.data;
        setAssignedUsers(data.assigned_users ?? []);

        const assignedIds = new Set((data.assigned_users ?? []).map((u: any) => u.id));
        const available: UserListItem[] = (usersRes.data.data ?? usersRes.data).filter(
          (u: UserListItem) =>
            !assignedIds.has(u.id) &&
            !NON_ASSIGNABLE_ROLES.has(u.role?.name ?? '')
        );
        setAvailableUsers(available);
      } catch { /* silent */ }
    } else {
      if (!selectedDepartmentId) return;
      const dept = departments.find((d) => d.id === selectedDepartmentId);
      if (!dept) return;
      try {
        const [agencyRes, deptRes] = await Promise.all([
          client.get(`/agencies/${dept.agency_id}`),
          client.get(`/departments/${selectedDepartmentId}/users`),
        ]);
        const agencyData = agencyRes.data.data ?? agencyRes.data;
        const agencyUsers: AssignedUser[] = agencyData.assigned_users ?? [];
        const deptUsersRaw: any[] = deptRes.data.data ?? deptRes.data;
        const deptUserIds = new Set(deptUsersRaw.map((u: any) => u.id));

        setAssignedUsers(deptUsersRaw.map((u: any) => ({ ...u, pivot: u.pivot ?? null })));

        const available: UserListItem[] = agencyUsers.filter(
          (u: AssignedUser) =>
            !deptUserIds.has(u.id) &&
            !NON_ASSIGNABLE_ROLES.has((u as any).role?.name ?? '')
        );
        setAvailableUsers(available as UserListItem[]);
      } catch { /* silent */ }
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await usersApi.remove(deleteTarget.id);
      showToast('Utilisateur supprimé avec succès.', 'success');
      setDeleteTarget(null);
      fetchUsers(fetchParams);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Impossible de supprimer cet utilisateur.'), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleCreateUser() {
    setCreateErrors({});
    setCreateSubmitting(true);
    try {
      await usersApi.create(createForm);
      showToast('Utilisateur créé avec succès.', 'success');
      setCreateOpen(false);
      setCreateForm({
        username: '',
        email: '',
        password: 'password',
        password_confirmation: 'password',
        first_name: '',
        last_name: '',
        phone: '',
        role_id: '',
      });
      fetchUsers(fetchParams);
    } catch (err) {
      const msg = extractErrorMessage(err);
      if (msg) showToast(msg, 'error');
      setCreateErrors(extractFieldErrors(err) as Record<string, string>);
    } finally {
      setCreateSubmitting(false);
    }
  }

  function getRoleBadge(roleName: string | null | undefined) {
    switch (roleName) {
      case 'super-admin':
        return <Badge variant="error">Super Admin</Badge>;
      case 'direction-generale':
        return <Badge variant="brand">Direction</Badge>;
      case 'responsable-agence':
        return <Badge variant="warning">Resp. Agence</Badge>;
      case 'responsable-departement':
        return <Badge variant="warning">Resp. Dép.</Badge>;
      case 'commercial':
        return <Badge variant="success">Commercial</Badge>;
      case 'caissier':
        return <Badge variant="neutral">Caissier</Badge>;
      case 'comptable':
        return <Badge variant="neutral">Comptable</Badge>;
      case 'formateur':
        return <Badge variant="brand">Formateur</Badge>;
      default:
        return <Badge variant="neutral">Aucun rôle</Badge>;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Utilisateurs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gestion des comptes utilisateurs et attribution des rôles.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, email, username..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        {currentUser?.role?.name !== 'responsable-departement' && (
          <div className="w-56">
            <Select
              label="Agence"
              value={selectedAgencyId}
              onChange={(e) => handleAgencyChange(e.target.value)}
            >
              <option value="">Toutes les agences</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="w-56">
          <Select
            label="Département"
            value={selectedDepartmentId}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            disabled={!selectedAgencyId && currentUser?.role?.name !== 'responsable-departement'}
          >
            <option value="">Tous les départements</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-3">
          {canCreateUsers && (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Créer
            </Button>
          )}
          {selectedAgencyId && !selectedDepartmentId && canManageUsers && (
            <Button onClick={() => openAssignModal('agency')}>
              <UserPlus className="h-4 w-4" />
              Assigner
            </Button>
          )}
          {selectedDepartmentId && canManageUsers && (
            <Button onClick={() => openAssignModal('department')}>
              <UserPlus className="h-4 w-4" />
              Assigner
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucun utilisateur trouvé.
              {canManageUsers && " Vous pouvez en créer un via l'écran d'inscription."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Nom</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Rôle</th>
                  <th className="px-5 py-3 font-medium">Agence</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {u.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {u.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3">{getRoleBadge(u.role?.name)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {u.assignments && u.assignments.length > 0
                        ? u.assignments.map((a) => a.name).join(', ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {u.is_active ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="error">Inactif</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {canManageUsers && (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewUser(u)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title="Voir le détail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Modal détail utilisateur */}
      <Modal
        isOpen={Boolean(viewUser)}
        onClose={() => setViewUser(null)}
        title="Détail de l'utilisateur"
        maxWidth="max-w-md"
      >
        {viewUser && (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Nom</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewUser.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Email</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewUser.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Téléphone</dt>
              <dd className="text-gray-800 dark:text-gray-100">{viewUser.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Rôle</dt>
              <dd className="text-gray-800 dark:text-gray-100">{getRoleBadge(viewUser.role?.name)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Statut</dt>
              <dd className="text-gray-800 dark:text-gray-100">
                {viewUser.is_active ? 'Actif' : 'Inactif'}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      {/* Modal modification utilisateur */}
      <Modal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title="Modifier l'utilisateur"
        maxWidth="max-w-lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleEditSubmitConfirm(); }} className="flex flex-col gap-4">
          {Object.keys(editErrors).length > 0 && (
            <Alert variant="error">
              {Object.values(editErrors).join(' ')}
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prénom"
              value={editForm.first_name}
              onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
            />
            <Input
              label="Nom"
              value={editForm.last_name}
              onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={editForm.email}
            onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
            error={editErrors.email}
          />
          <Input
            label="Téléphone"
            value={editForm.phone}
            onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
          />
          <Select
            label="Rôle"
            value={editForm.role_id}
            onChange={(e) => setEditForm((p) => ({ ...p, role_id: e.target.value }))}
          >
            <option value="">— Licencier (aucun rôle) —</option>
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {editUser?.role &&
              !assignableRoles.some((r) => r.id === editUser.role?.id) && (
                <option value={editUser.role.id}>{editUser.role.name}</option>
              )}
          </Select>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={editSubmitting}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal assignation */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={
          assignTargetType === 'agency'
            ? `Assigner des utilisateurs — ${agencies.find((a) => a.id === selectedAgencyId)?.name ?? ''}`
            : `Assigner des utilisateurs — ${departments.find((d) => d.id === selectedDepartmentId)?.name ?? ''}`
        }
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          {assignError && <Alert variant="error">{assignError}</Alert>}

          {assignLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                  Assignés ({assignedUsers.length})
                </p>
                {assignedUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Aucun utilisateur assigné.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {assignedUsers.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          {assignTargetType === 'agency' && u.pivot?.is_primary && <Badge variant="warning">Chef</Badge>}
                          {assignTargetType === 'department' && u.pivot?.is_department_chief && <Badge variant="warning">Chef</Badge>}
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {u.name}
                          </span>
                          <span className="text-gray-400">{u.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(u.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title="Retirer"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                  Ajouter
                </p>
                <Autocomplete
                  placeholder={availableUsers.length === 0 ? 'Aucun utilisateur disponible' : 'Rechercher par nom ou email...'}
                  value=""
                  onChange={(userId) => {
                    if (userId) handleAssignUser(userId);
                  }}
                  fetchOptions={async (query) => {
                    const q = query.toLowerCase();
                    return availableUsers
                      .filter(
                        (u) =>
                          u.name?.toLowerCase().includes(q) ||
                          u.email.toLowerCase().includes(q)
                      )
                      .slice(0, 20)
                      .map((u) => ({
                        id: u.id,
                        label: u.name ?? u.email,
                        subtitle: u.role?.name ? `${u.email} — ${u.role.name}` : u.email,
                      }));
                  }}
                  disabled={availableUsers.length === 0}
                />
              </div>
            </> 
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation licenciement */}
      <ConfirmDialog
        isOpen={Boolean(confirmRoleRemove)}
        title="Licencier cet utilisateur ?"
        message="Vous êtes sur le point de retirer le rôle de cet utilisateur. Cela signifie qu'il n'aura plus accès à l'application. Confirmez-vous ?"
        confirmLabel="Oui, licencier"
        variant="danger"
        onConfirm={() => confirmRoleRemove?.()}
        onCancel={() => setConfirmRoleRemove(null)}
      />

      {/* Confirmation suppression */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Supprimer cet utilisateur ?"
        message={
          deleteTarget
            ? `Êtes-vous sûr de vouloir supprimer définitivement ${deleteTarget.name} ? Cette action est irréversible.`
            : ''
        }
        confirmLabel="Oui, supprimer"
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal création utilisateur */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer un utilisateur"
        maxWidth="max-w-lg"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}
          className="flex flex-col gap-4"
        >
          {Object.keys(createErrors).length > 0 && (
            <Alert variant="error">{Object.values(createErrors).join(' ')}</Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prénom"
              name="first_name"
              value={createForm.first_name ?? ''}
              onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))}
              error={createErrors.first_name}
            />
            <Input
              label="Nom"
              name="last_name"
              value={createForm.last_name ?? ''}
              onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))}
              error={createErrors.last_name}
            />
          </div>

          <Input
            label="Nom d'utilisateur"
            name="username"
            required
            value={createForm.username}
            onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
            error={createErrors.username}
          />

          <Input
            label="Adresse email"
            type="email"
            name="email"
            required
            value={createForm.email}
            onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            error={createErrors.email}
          />

          <Input
            label="Téléphone"
            name="phone"
            value={createForm.phone ?? ''}
            onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
            error={createErrors.phone}
          />

          <Select
            label="Rôle"
            value={createForm.role_id ?? ''}
            onChange={(e) => setCreateForm((p) => ({ ...p, role_id: e.target.value }))}
          >
            <option value="">— Aucun rôle —</option>
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={createSubmitting}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
