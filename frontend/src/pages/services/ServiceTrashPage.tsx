import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { PaginationMeta } from '@/types/agency';
import type { Service } from '@/types/service';

export default function ServiceTrashPage() {
  const { showToast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<Service | null>(null);
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const fetchTrash = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await servicesApi.trash({ page, per_page: 15 });
      setServices(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, 'Impossible de charger la corbeille.'));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(service: Service) {
    try {
      await servicesApi.restore(service.id);
      showToast(`Service "${service.name}" restauré.`, 'success');
      setServices((prev) => prev.filter((item) => item.id !== service.id));
    } catch (error) {
      showToast(extractErrorMessage(error, 'Impossible de restaurer ce service.'), 'error');
    }
  }

  async function handleForceDelete() {
    if (!forceDeleteTarget) return;
    setIsForceDeleting(true);
    try {
      await servicesApi.forceDelete(forceDeleteTarget.id);
      showToast('Service supprimé définitivement.', 'success');
      setServices((prev) => prev.filter((item) => item.id !== forceDeleteTarget.id));
      setForceDeleteTarget(null);
    } catch (error) {
      showToast(
        extractErrorMessage(error, 'Impossible de supprimer définitivement ce service.'),
        'error'
      );
    } finally {
      setIsForceDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/services"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux services
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Corbeille — Services
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Services archivés. Réservé aux super-administrateurs.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : services.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">La corbeille est vide.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Catégorie</th>
                  <th className="px-5 py-3 font-medium">Supprimé le</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {service.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {service.category?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {service.deleted_at ? new Date(service.deleted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRestore(service)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-success-600 dark:hover:bg-gray-800"
                          title="Restaurer"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setForceDeleteTarget(service)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title="Supprimer définitivement"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
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

      <ConfirmDialog
        isOpen={Boolean(forceDeleteTarget)}
        title="Suppression définitive"
        message={`Le service "${forceDeleteTarget?.name}" sera supprimé définitivement et irréversiblement. Continuer ?`}
        confirmLabel="Supprimer définitivement"
        isLoading={isForceDeleting}
        onConfirm={handleForceDelete}
        onCancel={() => setForceDeleteTarget(null)}
      />
    </div>
  );
}
