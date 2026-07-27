import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Pencil, Eye, Users } from 'lucide-react';
import { departmentsApi } from '@/api/departments.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import {
  canCreateDepartment,
  canDeleteDepartment,
  canEditDepartment,
  canManageDepartmentTrash,
} from '@/utils/departmentPermissions';
import { DepartmentUserAssignModal } from '@/components/departments/DepartmentUserAssignModal';
import type { Department, DepartmentPayload } from '@/types/department';
import type { Agency, PaginationMeta } from '@/types/agency';

export default function DepartmentListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [page, setPage] = useState(1);

  const [formModal, setFormModal] = useState<{
    open: boolean;
    editing: Department | null;
  }>({ open: false, editing: null });
  const [form, setForm] = useState<DepartmentPayload>({
    agency_id: '',
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [detailDepartment, setDetailDepartment] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usersDepartment, setUsersDepartment] = useState<Department | null>(null);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await departmentsApi.list({
        search: search || undefined,
        agency_id: agencyFilter || undefined,
        page,
        per_page: 15,
      });
      setDepartments(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, 'Impossible de charger les départements.'));
    } finally {
      setIsLoading(false);
    }
  }, [search, agencyFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchDepartments();
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, agencyFilter]);

  useEffect(() => {
    fetchDepartments();
  }, [page]);

  useEffect(() => {
    agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
  }, []);

  function openCreate() {
    setForm({ agency_id: agencies[0]?.id ?? '', name: '', description: '' });
    setFormErrors({});
    setFormModal({ open: true, editing: null });
  }

  function openEdit(dept: Department) {
    setForm({
      agency_id: dept.agency_id,
      name: dept.name,
      description: dept.description ?? '',
    });
    setFormErrors({});
    setFormModal({ open: true, editing: dept });
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    try {
      if (formModal.editing) {
        await departmentsApi.update(formModal.editing.id, form);
        showToast('Département modifié avec succès.', 'success');
      } else {
        await departmentsApi.create(form);
        showToast('Département créé avec succès.', 'success');
      }
      setFormModal({ open: false, editing: null });
      fetchDepartments();
    } catch (error) {
      setFormErrors(
        Object.fromEntries(
          Object.entries(
            (error as any).response?.data?.errors ?? {}
          ).map(([k, v]: [string, any]) => [k, v[0]])
        )
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await departmentsApi.remove(deleteTarget.id);
      showToast('Département archivé.', 'success');
      setDeleteTarget(null);
      fetchDepartments();
    } catch (error) {
      showToast(extractErrorMessage(error, 'Impossible de supprimer ce département.'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Départements</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestion des départements par agence.
          </p>
        </div>
        <div className="flex gap-3">
          {canManageDepartmentTrash(user) && (
            <Link to="/departments/trash">
              <Button variant="outline">
                <Trash2 className="h-4 w-4" />
                Corbeille
              </Button>
            </Link>
          )}
          {canCreateDepartment(user) && (
            <div className="w-52">
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nouveau département
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Recherche
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom du département..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="sm:w-64">
          <Select
            label="Agence"
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
          >
            <option value="">Toutes les agences</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
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
        ) : departments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Aucun département trouvé.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Nom</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Agence</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {dept.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {dept.description ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {dept.agency?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailDepartment(dept)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title="Voir le détail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditDepartment(user) && (
                          <>
                            <button
                              type="button"
                              onClick={() => setUsersDepartment(dept)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-purple-600 dark:hover:bg-gray-800"
                              title="Gérer les utilisateurs"
                            >
                              <Users className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(dept)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                              title="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {canDeleteDepartment(user) && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(dept)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Modal détail */}
      <Modal
        isOpen={Boolean(detailDepartment)}
        onClose={() => setDetailDepartment(null)}
        title="Détail du département"
        maxWidth="max-w-md"
      >
        {detailDepartment && (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Nom</dt>
              <dd className="text-gray-800 dark:text-gray-100">{detailDepartment.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Description</dt>
              <dd className="text-gray-800 dark:text-gray-100">
                {detailDepartment.description ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Agence</dt>
              <dd className="text-gray-800 dark:text-gray-100">
                {detailDepartment.agency?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Créé le</dt>
              <dd className="text-gray-800 dark:text-gray-100">
                {new Date(detailDepartment.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        )}
      </Modal>

      {/* Modal création / édition */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, editing: null })}
        title={formModal.editing ? 'Modifier le département' : 'Nouveau département'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && (
            <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
          )}
          <Select
            label="Agence"
            required
            value={form.agency_id}
            onChange={(e) => setForm((p) => ({ ...p, agency_id: e.target.value }))}
            error={formErrors.agency_id}
          >
            <option value="">— Sélectionner une agence —</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </Select>
          <Input
            label="Nom"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            error={formErrors.name}
          />
          <Input
            label="Description"
            value={form.description ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormModal({ open: false, editing: null })}
            >
              Annuler
            </Button>
            <Button type="submit" isLoading={formSubmitting}>
              {formModal.editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Archiver ce département ?"
        message={`Le département "${deleteTarget?.name}" sera déplacé vers la corbeille.`}
        confirmLabel="Archiver"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal affectation utilisateurs */}
      <DepartmentUserAssignModal
        isOpen={Boolean(usersDepartment)}
        department={usersDepartment}
        onClose={() => setUsersDepartment(null)}
        onSaved={fetchDepartments}
      />
    </div>
  );
}
