import { useTranslation } from 'react-i18next';
import { Check, Building2, UserPlus } from 'lucide-react';
import { formatCurrency, packagePeriodLabel } from '@/utils';
import type { PublicPackage } from '@/types';

/**
 * Carte package « façon flyer » — copie fidèle de la carte utilisée par
 * l'application interne (admin / commercial / caissier) : même rendu, mêmes
 * libellés, mêmes couleurs. Le client clique pour ouvrir la fiche et souscrire.
 */
export function PackageCard({
  pkg,
  showAgency = true,
  onOpen,
  onSubscribe,
}: {
  pkg: PublicPackage;
  /** Affiche le nom de l'agence (masqué quand le catalogue est déjà filtré par agence). */
  showAgency?: boolean;
  onOpen: (pkg: PublicPackage) => void;
  /** Clic sur le bouton « Souscrire » (fiche + formulaire de souscription). */
  onSubscribe?: (pkg: PublicPackage) => void;
}) {
  const { t } = useTranslation();
  const price = Number(pkg.price_per_month);
  const effective = Number(pkg.effective_price);
  const hasPromo = effective < price;
  const original = pkg.original_price ? Number(pkg.original_price) : null;
  const multiAgency = pkg.agency_count > 1;
  const activePromo = pkg.promotions.find((promo) => promo.is_active);

  return (
    <div
      onClick={() => onOpen(pkg)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(pkg);
      }}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer flex-col rounded-2xl border-2 border-amber-300/70 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="text-center">
        <h3 className="text-lg font-bold uppercase text-gray-900">{pkg.name}</h3>
        {pkg.code && <p className="mt-0.5 text-xs uppercase tracking-widest text-gray-400">{pkg.code}</p>}
        {pkg.tagline && <p className="mt-1 text-sm font-medium uppercase text-gray-500">{pkg.tagline}</p>}
        {showAgency && !multiAgency && pkg.agency?.name && <p className="mt-1 text-xs text-gray-400">{pkg.agency.name}</p>}
        {multiAgency && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600">
            <Building2 size={12} />
            {t('catalog.availableAt', { count: pkg.agency_count })}
          </p>
        )}
        {(hasPromo || activePromo) && (
          <span className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {t('packages.promoActive')}
          </span>
        )}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-gray-600">
        {pkg.items.map((item) => (
          <li key={item.id ?? item.label} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {pkg.recommendations.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs">
          <p className="font-semibold uppercase text-amber-800">{t('packages.recommendations')}</p>
          {pkg.recommendations.map((r) => (
            <p key={r.id ?? r.label} className="uppercase text-amber-900">
              {String(r.quantity ?? 1).padStart(2, '0')} {r.label}
            </p>
          ))}
        </div>
      )}

      {pkg.prerequisites && (
        <p className="mt-3 text-xs text-gray-500">
          <strong>{t('packages.prerequisites')} :</strong> {pkg.prerequisites}
        </p>
      )}

      <div className="mt-4 text-center">
        {(original || hasPromo) && (
          <p className="text-sm text-gray-400 line-through">{formatCurrency(hasPromo ? price : original as number)}</p>
        )}
        <p className="text-2xl font-bold text-gray-900">
          {pkg.price_is_starting_from && (
            <span className="mr-1 text-xs font-normal text-gray-500">{t('packages.startingFrom')}</span>
          )}
          {formatCurrency(pkg.effective_price)}
          <span className="text-xs font-normal text-gray-500"> {t(packagePeriodLabel(pkg.billing_period))}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            (onSubscribe ?? onOpen)(pkg);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:bg-brand-300"
        >
          <UserPlus className="mr-1.5 h-4 w-4" /> {t('packages.subscribe')}
        </button>
      </div>
    </div>
  );
}

/**
 * Regroupement par catégorie — même logique que l'app interne :
 * « Packages stratégiques mensuels » et « Services à la carte ».
 */
export function groupPackagesByCategory(
  packages: PublicPackage[],
  uncategorizedLabel: string,
): { name: string; items: PublicPackage[] }[] {
  const groups = new Map<string, { name: string; items: PublicPackage[] }>();
  for (const p of packages) {
    const name = p.category?.name ?? uncategorizedLabel;
    if (!groups.has(name)) groups.set(name, { name, items: [] });
    groups.get(name)!.items.push(p);
  }
  return [...groups.values()];
}
