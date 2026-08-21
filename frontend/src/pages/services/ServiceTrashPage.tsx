import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Service } from '@/types/service';
import type { PaginationMeta } from '@/types/agency';

interface ServiceTrashPageProps {
  agencyId?: string;
}

export default function ServiceTrashPage({ agencyId }: ServiceTrashPageProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { countryId } = useParams<{ countryId?: string }>();

  const backToServices = agencyId
    ? countryId
      ? `/countries/${countryId}/agencies/${agencyId}/services`
      : `/agencies/${agencyId}/services`
    : countryId
      ? `/countries/${countryId}/catalog/services`
      : '/catalog/services';

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
      const response = await servicesApi.trash({
        page,
        per_page: 15,
        agency_id: agencyId ?? undefined,
      });
      setServices(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('services.trashLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [page, agencyId]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(service: Service) {
    try {
      await servicesApi.restore(service.id);
      showToast(t('services.restored', { name: service.name }), 'success');
      setServices((prev) => prev.filter((item) => item.id !== service.id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('services.restoreFailed')), 'error');
    }
  }

  async function handleForceDelete() {
    if (!forceDeleteTarget) return;
    setIsForceDeleting(true);
    try {
      await servicesApi.forceDelete(forceDeleteTarget.id);
      showToast(t('services.forceDeleted'), 'success');
      setServices((prev) => prev.filter((item) => item.id !== forceDeleteTarget.id));
      setForceDeleteTarget(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('services.forceDeleteFailed')), 'error');
    } finally {
      setIsForceDeleting(false);
    }
  }

  function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(currentLocale());
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={backToServices}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('services.backToServices')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('services.trashTitle')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('services.trashSubtitle')}</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : services.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('common.trashEmpty')}</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  {service.cover_image ? (
                    <img
                      src={service.cover_image}
                      alt={service.name}
                      className="h-12 w-12 shrink-0 rounded-xl border border-gray-100 object-cover dark:border-gray-800"
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: service.category?.color ?? '#CBD5E1' }}
                    >
                      <CategoryIcon name={service.category?.icon} className="h-6 w-6 text-white" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{service.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">{service.category?.name}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleRestore(service)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-success-600 dark:hover:bg-gray-800"
                      title={t('common.restore')}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceDeleteTarget(service)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title={t('common.deletePermanently')}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {service.agency?.name ?? '—'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('services.deletedAt')}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {formatDate(service.deleted_at)}
                  </span>
                </div>
              </div>
            ))}
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
        title={t('services.forceDeleteTitle')}
        message={t('services.forceDeleteMessage', { name: forceDeleteTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        isLoading={isForceDeleting}
        onConfirm={handleForceDelete}
        onCancel={() => setForceDeleteTarget(null)}
      />
    </div>
  );
}
