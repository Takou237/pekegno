import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Percent, Trash2, UserPlus } from 'lucide-react';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import type { AgencyPackage } from '@/types/agencyDepartment';

/**
 * Carte package « façon flyer » — source unique de vérité pour l'affichage.
 * Utilisée par la page département (admin) ET l'onglet Packages du catalogue
 * (commercial / caissier) pour garantir un rendu strictement identique.
 */
export function PackageCard({
  pkg,
  canManage,
  canSubscribe,
  showAgency = false,
  onEdit,
  onPromo,
  onSubscribe,
  onOpen,
  onSubscriptions,
  onDelete,
}: {
  pkg: AgencyPackage;
  canManage: boolean;
  canSubscribe: boolean;
  /** Affiche le nom de l'agence (vue catalogue multi-agences de l'admin). */
  showAgency?: boolean;
  onEdit?: () => void;
  onPromo?: () => void;
  onSubscribe?: () => void;
  /** Clic sur la carte : page « Souscriptions du pack ». */
  onOpen?: () => void;
  /** Lien/bouton « N souscriptions ». */
  onSubscriptions?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const price = Number(pkg.price_per_month);
  const hasPromo = pkg.effective_price < price;
  const original = pkg.original_price ? Number(pkg.original_price) : null;

  function handleOpen(e: MouseEvent) {
    if (!onOpen) return;
    const el = e.target as HTMLElement;
    if (el.closest('button, a, input, label, select')) return;
    onOpen();
  }

  return (
    <div
      onClick={handleOpen}
      className={`flex flex-col rounded-2xl border-2 bg-white p-5 dark:bg-gray-900 ${pkg.is_active ? 'border-amber-300/70 dark:border-amber-500/40' : 'border-gray-100 opacity-60 dark:border-gray-800'} ${onOpen ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <div className="text-center">
        <h3 className="text-lg font-bold uppercase text-gray-900 dark:text-white">{pkg.name}</h3>
        {pkg.code && <p className="mt-0.5 text-xs uppercase tracking-widest text-gray-400">{pkg.code}</p>}
        {pkg.tagline && <p className="mt-1 text-sm font-medium uppercase text-gray-500 dark:text-gray-400">{pkg.tagline}</p>}
        {showAgency && pkg.agency?.name && <p className="mt-1 text-xs text-gray-400">{pkg.agency.name}</p>}
        {hasPromo && <span className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{t('agencyDept.packages.promoActive')}</span>}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
        {pkg.items.map((item) => (
          <li key={item.id ?? item.label} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {pkg.recommendations.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs dark:bg-amber-500/10">
          <p className="font-semibold uppercase text-amber-800 dark:text-amber-300">{t('agencyDept.packages.recommendations')}</p>
          {pkg.recommendations.map((r) => (
            <p key={r.id ?? r.label} className="uppercase text-amber-900 dark:text-amber-200">
              {String(r.quantity ?? 1).padStart(2, '0')} {r.label}
            </p>
          ))}
        </div>
      )}

      {pkg.prerequisites && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400"><strong>{t('agencyDept.packages.prerequisites')} :</strong> {pkg.prerequisites}</p>}

      <div className="mt-4 text-center">
        {(original || hasPromo) && (
          <p className="text-sm text-gray-400 line-through">{formatCurrency(hasPromo ? price : original)}</p>
        )}
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {pkg.price_is_starting_from && <span className="mr-1 text-xs font-normal text-gray-500">{t('agencyDept.packages.from')}</span>}
          {formatCurrency(pkg.effective_price)}
          <span className="text-xs font-normal text-gray-500"> / {t(`agencyDept.billingPeriod.${pkg.billing_period}`)}</span>
        </p>
        {pkg.contracts_count !== undefined && pkg.contracts_count !== null && onSubscriptions ? (
          <button
            type="button"
            onClick={onSubscriptions}
            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('agencyDept.packages.subscriptionsCount', { count: pkg.contracts_count })}
          </button>
        ) : pkg.contracts_count !== undefined && pkg.contracts_count !== null ? (
          <p className="text-xs text-gray-400">{t('agencyDept.packages.contractsCount', { count: pkg.contracts_count })}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {canSubscribe && onSubscribe && (
          <Button size="sm" onClick={onSubscribe}><UserPlus className="h-4 w-4" /> {t('agencyDept.packages.subscribe')}</Button>
        )}
        {canManage && (
          <>
            {onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit} title={t('common.edit')}><Pencil className="h-4 w-4" /></Button>
            )}
            {onPromo && (
              <Button size="sm" variant="outline" onClick={onPromo} title={t('agencyDept.packages.promotions')}><Percent className="h-4 w-4" /></Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete} title={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Regroupement par catégorie (§6.2) — deux sections typiques :
 * « Packages stratégiques mensuels » et « Services à la carte ».
 * Regroupé par NOM de catégorie : deux départements partageant le même nom
 * donnent une seule section (pas de doublon).
 */
export function groupPackagesByCategory(
  packages: AgencyPackage[],
  uncategorizedLabel: string,
): { name: string; items: AgencyPackage[] }[] {
  const groups = new Map<string, { name: string; items: AgencyPackage[] }>();
  for (const p of packages) {
    const name = p.category?.name ?? uncategorizedLabel;
    if (!groups.has(name)) groups.set(name, { name, items: [] });
    groups.get(name)!.items.push(p);
  }
  return [...groups.values()];
}
