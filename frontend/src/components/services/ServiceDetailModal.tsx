import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { PriceHistory, Promotion, Service } from '@/types/service';

interface ServiceDetailModalProps {
  service: Service | null;
  onClose: () => void;
}

type Tab = 'details' | 'promotions' | 'history';

const TABS: { value: Tab; label: string }[] = [
  { value: 'details', label: 'Détails' },
  { value: 'promotions', label: 'Promotions' },
  { value: 'history', label: 'Historique des prix' },
];

function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `${number.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function promotionStatus(promotion: Promotion): { label: string; variant: 'success' | 'error' | 'warning' | 'neutral' } {
  if (!promotion.is_active) return { label: 'Désactivée', variant: 'neutral' };
  if (promotion.is_expired) return { label: 'Expirée', variant: 'warning' };
  return { label: 'Active', variant: 'success' };
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
  const [tab, setTab] = useState<Tab>('details');
  const hasPromotions = (service?.promotions ?? []).length > 0;
  const hasHistory = (service?.price_history ?? []).length > 0;

  if (!service) {
    return null;
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={service.name} maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {service.category && (
          <Badge variant="brand">{service.category.name}</Badge>
        )}
        {service.has_active_promotion && service.active_promotion ? (
          <Badge variant="success">
            Promo : {formatPrice(service.active_promotion.promotional_price)}
          </Badge>
        ) : (
          <Badge variant="neutral">Prix normal</Badge>
        )}
        {service.agency && <Badge variant="neutral">Agence : {service.agency.name}</Badge>}
        {service.department && (
          <Badge variant="neutral">Département : {service.department.name}</Badge>
        )}
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {TABS.map(({ value, label }) => (
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
          <DetailRow label="Prix de base">
            <span className="font-medium">{formatPrice(service.price)}</span>
          </DetailRow>
          <DetailRow label="Prix actuel">
            <span className="font-medium text-brand-600 dark:text-brand-400">
              {formatPrice(service.current_price)}
            </span>
          </DetailRow>
          <DetailRow label="Couverture">{service.coverage || '—'}</DetailRow>
          <DetailRow label="Catégorie">{service.category?.name || '—'}</DetailRow>
          <DetailRow label="Agence">{service.agency?.name || '—'}</DetailRow>
          <DetailRow label="Département">{service.department?.name || '—'}</DetailRow>
          <div className="sm:col-span-2">
            <DetailRow label="Description">{service.description || '—'}</DetailRow>
          </div>
          {service.presentation_video && (
            <div className="sm:col-span-2">
              <DetailRow label="Vidéo de présentation">
                <a
                  href={service.presentation_video}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"
                >
                  <Link2 className="h-4 w-4" />
                  Voir la vidéo
                </a>
              </DetailRow>
            </div>
          )}
          <DetailRow label="Créé le">{formatDate(service.created_at)}</DetailRow>
          <DetailRow label="Modifié le">{formatDate(service.updated_at)}</DetailRow>
        </dl>
      )}

      {tab === 'promotions' && (
        <div>
          {!hasPromotions ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Aucune promotion pour ce service.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 font-medium">Prix promotionnel</th>
                  <th className="px-3 py-2 font-medium">Début</th>
                  <th className="px-3 py-2 font-medium">Fin</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(service.promotions ?? []).map((promotion) => {
                  const status = promotionStatus(promotion);
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
              Aucun changement de prix enregistré.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-3 py-2 font-medium">Prix</th>
                  <th className="px-3 py-2 font-medium">Modifié par</th>
                  <th className="px-3 py-2 font-medium">Motif</th>
                  <th className="px-3 py-2 font-medium">Le</th>
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
