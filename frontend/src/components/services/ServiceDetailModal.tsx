import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { currentCurrency, currentLocale } from '@/i18n';
import type { PriceHistory, Promotion, Service } from '@/types/service';

interface ServiceDetailModalProps {
  service: Service | null;
  onClose: () => void;
}

type Tab = 'details' | 'promotions' | 'history';

function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `${number.toLocaleString(currentLocale(), { maximumFractionDigits: 2 })} ${currentCurrency()}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(currentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function promotionStatus(
  promotion: Promotion,
  t: (key: string) => string
): { label: string; variant: 'success' | 'error' | 'warning' | 'neutral' } {
  if (!promotion.is_active) return { label: t('services.promoStatusDisabled'), variant: 'neutral' };
  if (promotion.is_expired) return { label: t('services.promoStatusExpired'), variant: 'warning' };
  return { label: t('services.promoStatusActive'), variant: 'success' };
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 dark:text-gray-100">{children}</dd>
    </div>
  );
}

export function ServiceDetailModal({ service, onClose }: ServiceDetailModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('details');
  const hasPromotions = (service?.promotions ?? []).length > 0;
  const hasHistory = (service?.price_history ?? []).length > 0;

  if (!service) {
    return null;
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'details', label: t('services.details') },
    { value: 'promotions', label: t('services.promotions') },
    { value: 'history', label: t('services.priceHistory') },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title={service.name} maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {service.category && (
          <Badge variant="brand">{service.category.name}</Badge>
        )}
        {service.has_active_promotion && service.active_promotion ? (
          <Badge variant="success">
            {t('services.promo', {
              price: formatPrice(service.active_promotion.promotional_price),
            })}
          </Badge>
        ) : (
          <Badge variant="neutral">{t('services.normalPrice')}</Badge>
        )}
        {service.agency && (
          <Badge variant="neutral">{t('services.agencyBadge', { name: service.agency.name })}</Badge>
        )}
        {service.department && (
          <Badge variant="neutral">
            {t('services.departmentBadge', { name: service.department.name })}
          </Badge>
        )}
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailRow label={t('services.basePrice')}>
            <span className="font-medium">{formatPrice(service.price)}</span>
          </DetailRow>
          <DetailRow label={t('services.currentPrice')}>
            <span className="font-medium text-brand-600 dark:text-brand-400">
              {formatPrice(service.current_price)}
            </span>
          </DetailRow>
          <DetailRow label={t('services.coverage')}>{service.coverage || '—'}</DetailRow>
          <DetailRow label={t('services.category')}>{service.category?.name || '—'}</DetailRow>
          <DetailRow label={t('services.agency')}>{service.agency?.name || '—'}</DetailRow>
          <DetailRow label={t('services.department')}>
            {service.department?.name || '—'}
          </DetailRow>
          <div className="sm:col-span-2">
            <DetailRow label={t('services.description')}>{service.description || '—'}</DetailRow>
          </div>
          {service.presentation_video && (
            <div className="sm:col-span-2">
              <DetailRow label={t('services.video')}>
                <a
                  href={service.presentation_video}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"
                >
                  <Link2 className="h-4 w-4" />
                  {t('services.seeVideo')}
                </a>
              </DetailRow>
            </div>
          )}
          <DetailRow label={t('services.createdOn')}>{formatDate(service.created_at)}</DetailRow>
          <DetailRow label={t('services.updatedOn')}>{formatDate(service.updated_at)}</DetailRow>
        </dl>
      )}

      {tab === 'promotions' && (
        <div>
          {!hasPromotions ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('services.noPromotionsForService')}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('services.colPromotionalPrice')}</th>
                  <th className="px-3 py-2 font-medium">{t('services.colStart')}</th>
                  <th className="px-3 py-2 font-medium">{t('services.colEnd')}</th>
                  <th className="px-3 py-2 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(service.promotions ?? []).map((promotion) => {
                  const status = promotionStatus(promotion, t);
                  return (
                    <tr key={promotion.id}>
                      <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-100">
                        {formatPrice(promotion.promotional_price)}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">
                        {formatDate(promotion.start_date)}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">
                        {formatDate(promotion.end_date)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {!hasHistory ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('services.noPriceHistory')}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('services.colPrice')}</th>
                  <th className="px-3 py-2 font-medium">{t('services.colChangedBy')}</th>
                  <th className="px-3 py-2 font-medium">{t('services.colReason')}</th>
                  <th className="px-3 py-2 font-medium">{t('services.colDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(service.price_history ?? []).map((entry: PriceHistory) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {formatPrice(entry.price)}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">
                      {entry.changed_by_name || '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">
                      {entry.reason || '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Modal>
  );
}
