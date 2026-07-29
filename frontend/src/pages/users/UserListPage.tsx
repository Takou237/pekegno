import { useCallback, useEffect, useState } from 'react';
import { Search, Pencil } from 'lucide-react';
import { usersApi } from '@/api/users.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import type { UserListItem, RoleListItem } from '@/types/user';
import type { Agency, Department, PaginationMeta } from '@/types/agency';

export default function UserListPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');

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

  const canManageUsers = ['super-admin', 'direction-generale'].includes(
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

  useEffect(() => {
    fetchUsers({ search, agency_id: selectedAgencyId || undefined, department_id: selectedDepartmentId || undefined, page: 1 });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUsers({ search, agency_id: selectedAgencyId || undefined, department_id: selectedDepartmentId || undefined, page: 1 });
    }, 350);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    usersApi.listRoles().then(setRoles).catch(() => {});
  }, []);

  function handleAgencyChange(agencyId: string) {
    const agency = agencies.find((a) => a.id === agencyId);
    setSelectedAgencyId(agencyId);
    setSelectedDepartmentId('');
    setDepartments(agency?.departments ?? []);
    setPage(1);
    fetchUsers({ search, agency_id: agencyId || undefined, department_id: undefined, page: 1 });
  }

  function handleDepartmentChange(departmentId: string) {
    setSelectedDepartmentId(departmentId);
    setPage(1);
    fetchUsers({ search, agency_id: selectedAgencyId || undefined, department_id: departmentId || undefined, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchUsers({ search, agency_id: selectedAgencyId || undefined, department_id: selectedDepartmentId || undefined, page: newPage });
  }

  useEffect(() => {
    agenciesApi.list({ per_page: 100 }).then((res) => {
      setAgencies(res.data ?? []);
    }).catch(() => {});
  }, []);

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

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSubmitting(true);
    setEditErrors({});
    try {
      await usersApi.update(editUser.id, editForm);
      showToast('Utilisateur modifié avec succès.', 'success');
      setEditUser(null);
      fetchUsers({ search, agency_id: selectedAgencyId || undefined, department_id: selectedDepartmentId || undefined, page });
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
        <div className="w-56">
          <Select
            label="Département"
            value={selectedDepartmentId}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            disabled={!selectedAgencyId}
          >
            <option value="">Tous les départements</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
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
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Nom</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Rôle</th>
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
                            onClick={() => openEdit(u)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
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

      {/* Modal modification utilisateur */}
      <Modal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title="Modifier l'utilisateur"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
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
            <option value="">— Aucun rôle —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
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

    </div>
  );
}
