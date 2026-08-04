import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage } from '@/api/errors';
import { currentLocale } from '@/i18n';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Service } from '@/types/service';

interface ServiceDetailModalProps {
  serviceId: string | null;
  initial?: Service | null;
  onClose: () => void;
}

export function ServiceDetailModal({ serviceId, initial, onClose }: ServiceDetailModalProps) {
  const { t } = useTranslation();
  const [service, setService] = useState<Service | null>(initial ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) return;
    setIsLoading(true);
    setLoadError(null);
    servicesApi
      .get(serviceId)
      .then(setService)
      .catch((error) => setLoadError(extractErrorMessage(error, t('services.loadFailed'))))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(currentLocale());
  }

  function formatPrice(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.NumberFormat(currentLocale(), {
      style: 'currency',
      currency: 'XAF',
      maximumFractionDigits: 0,
    }).format(Number(value));
  }

  return (
    <Modal
      isOpen={Boolean(serviceId)}
      onClose={onClose}
      title={t('services.detailTitle')}
      maxWidth="max-w-3xl"
    >
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : loadError ? (
        <p className="text-sm text-error-500">{loadError}</p>
      ) : service ? (
        <div className="flex flex-col gap-5">
          <div className="flex gap-4">
            {service.cover_image ? (
              <img
                src={service.cover_image}
                alt={service.name}
                className="h-24 w-24 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700"
                style={{ backgroundColor: service.category?.color ?? '#CBD5E1' }}
              >
                <CategoryIcon name={service.category?.icon} className="h-10 w-10 text-white" />
              </div>
            )}
            <div className="flex flex-col justify-center gap-1.5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{service.name}</h3>
              <div className="flex flex-wrap gap-2">
                {service.category && <Badge variant="brand">{service.category.name}</Badge>}
                {service.agency && <Badge>{t('services.badgeAgency')}</Badge>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
              <dt className="text-xs uppercase text-gray-400">{t('services.price')}</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {formatPrice(service.price)}
              </dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
              <dt className="text-xs uppercase text-gray-400">{t('services.effectivePrice')}</dt>
              <dd className="mt-1 text-lg font-semibold text-brand-600 dark:text-brand-400">
                {formatPrice(service.effective_price)}
              </dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
              <dt className="text-xs uppercase text-gray-400">{t('services.createdAt')}</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {formatDate(service.created_at)}
              </dd>
            </div>
          </div>

          <div>
            <dt className="text-xs uppercase text-gray-400">{t('services.attachedTo')}</dt>
            <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
              {service.agency ? `${service.agency.name} (${t('services.anAgency')})` : '—'}
            </dd>
          </div>

          {service.description && (
            <div>
              <dt className="text-xs uppercase text-gray-400">{t('services.description')}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                {service.description}
              </dd>
            </div>
          )}

          {service.presentation_video && (
            <div>
              <dt className="text-xs uppercase text-gray-400">{t('services.presentationVideo')}</dt>
              <dd className="mt-1">
                <a
                  href={service.presentation_video}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-600 hover:underline dark:text-brand-400"
                >
                  {service.presentation_video}
                </a>
              </dd>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('services.promotions')}
            </h4>
            {service.promotions && service.promotions.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t('services.promoPrice')}</th>
                      <th className="px-4 py-2 font-medium">{t('services.promoStart')}</th>
                      <th className="px-4 py-2 font-medium">{t('services.promoEnd')}</th>
                      <th className="px-4 py-2 font-medium">{t('services.promoStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {service.promotions.map((promotion) => (
                      <tr key={promotion.id}>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">
                          {formatPrice(promotion.promo_price)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {formatDate(promotion.start_date)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {formatDate(promotion.end_date)}
                        </td>
                        <td className="px-4 py-2">
                          {promotion.is_active ? (
                            <Badge variant="success">{t('services.promoActive')}</Badge>
                          ) : (
                            <Badge variant="neutral">{t('services.promoInactive')}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('services.noPromotions')}</p>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('services.priceHistory')}
            </h4>
            {service.price_history && service.price_history.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t('services.price')}</th>
                      <th className="px-4 py-2 font-medium">{t('services.priceChangedAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {service.price_history.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">
                          {formatPrice(entry.price)}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {new Date(entry.changed_at).toLocaleString(currentLocale())}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('services.noPriceHistory')}</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
