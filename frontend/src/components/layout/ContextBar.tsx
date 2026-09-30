import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe, Building2, FolderTree, Bell, Menu, ImageIcon, FileText } from 'lucide-react';
import { useOrgContext } from '@/context/OrgContext';
import { useAuth } from '@/hooks/useAuth';
import { invoicesApi } from '@/api/invoices.api';
import { formatCurrency } from '@/utils/number';
import { UserMenu } from '@/components/common/UserMenu';
import { Spinner } from '@/components/ui/Spinner';
import type { Invoice } from '@/types/invoice';
import { BrandLogo } from '@/components/common/BrandLogo';

const CAN_VALIDATE_ROLES = new Set(['super-admin', 'direction-generale', 'responsable-agence', 'caissier']);
const COMMERCIAL_ROLE = 'commercial';

function seenValidatedKey(userId: string) {
  return `pekegno.invoices.validatedSeenAt.${userId}`;
}

interface Option {
  value: string;
  label: string;
}

interface OptionGroup {
  label?: string;
  options: Option[];
}

function SelectDropdown({
  label,
  icon: Icon,
  value,
  onChange,
  groups,
  placeholder,
  className = '',
}: {
  className?: string;
  label: string;
  icon: typeof Globe;
  value: string | null;
  onChange: (val: string) => void;
  groups: OptionGroup[];
  placeholder: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <label className="sr-only">{label}</label>
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
        <Icon className="h-4 w-4" />
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 appearance-none truncate rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500/50"
      >
        <option value="">{placeholder}</option>
        {groups.map((group, index) =>
          group.label ? (
            <optgroup key={index} label={group.label}>
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          ),
        )}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
        <ChevronDown className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

interface ContextBarProps {
  /** Extra content placed after the dropdowns, on the left side (e.g. back button). */
  leftSlot?: ReactNode;
  /** Additional right-side items rendered before bell + UserMenu. */
  rightSlot?: ReactNode;
  /** Mobile hamburger toggle – shown only on small screens. */
  onMobileMenuToggle?: () => void;
}

export function ContextBar({ leftSlot, rightSlot, onMobileMenuToggle }: ContextBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { countries, selection, loading, setSelection } = useOrgContext();
  const showOrgSelectors = !['commercial', 'caissier'].includes(user?.role?.name ?? '');

  const canValidate = CAN_VALIDATE_ROLES.has(user?.role?.name ?? '');
  const isCommercial = user?.role?.name === COMMERCIAL_ROLE;
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [validatedInvoices, setValidatedInvoices] = useState<Invoice[]>([]);
  const [validatedUnseenTotal, setValidatedUnseenTotal] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canValidate) return;
    let cancelled = false;
    invoicesApi
      .list({ validation_status: 'pending', per_page: 5 })
      .then((res) => {
        if (cancelled) return;
        setPendingInvoices(res.invoices.data);
        setPendingTotal(res.invoices.meta.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canValidate, location.pathname]);

  // Un commercial n'a pas de compteur "en attente" (il ne valide rien) : on le notifie
  // plutôt dès que l'une de ses factures vient d'être validée par un caissier/admin.
  // Comme il n'existe pas de table de notifications persistées côté backend, on
  // compare les factures validées à la dernière consultation de la cloche (stockée
  // en localStorage) pour ne compter que les nouveautés.
  useEffect(() => {
    if (!isCommercial || !user) return;
    let cancelled = false;
    invoicesApi
      .list({ validation_status: 'validated', per_page: 20 })
      .then((res) => {
        if (cancelled) return;
        const sorted = [...res.invoices.data].sort(
          (a, b) => new Date(b.validated_at ?? 0).getTime() - new Date(a.validated_at ?? 0).getTime(),
        );
        let lastSeen = localStorage.getItem(seenValidatedKey(user.id));
        if (lastSeen === null) {
          // Premier passage : on ne notifie pas rétroactivement tout l'historique,
          // seulement les factures validées à partir de maintenant.
          lastSeen = new Date().toISOString();
          localStorage.setItem(seenValidatedKey(user.id), lastSeen);
        }
        const lastSeenTime = new Date(lastSeen).getTime();
        const unseen = sorted.filter(
          (inv) => inv.validated_at && new Date(inv.validated_at).getTime() > lastSeenTime,
        );
        setValidatedInvoices(sorted.slice(0, 5));
        setValidatedUnseenTotal(unseen.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCommercial, user, location.pathname]);

  useEffect(() => {
    if (!notifOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const findAgency = useCallback(
    (agencyId: string) => {
      for (const country of countries) {
        const agency = country.agencies.find((a) => a.id === agencyId);
        if (agency) return agency;
      }
      return null;
    },
    [countries],
  );

  const findDepartmentContext = useCallback(
    (departmentId: string) => {
      for (const country of countries) {
        for (const agency of country.agencies) {
          const dept = agency.departments.find((d) => d.id === departmentId);
          if (dept) return { countryId: country.id, agencyId: agency.id, departmentId: dept.id };
        }
      }
      return null;
    },
    [countries],
  );

  // Keep the header selection in sync with the current URL so the three
  // dropdowns always reflect the page being viewed (direct links, sidebar,
  // back button, switchers, ...).
  useEffect(() => {
    if (loading) return;

    const segments = location.pathname.split('/').filter(Boolean);

    // /countries/:countryId/agencies/:agencyId/...
    if (segments[0] === 'countries' && segments[1] && segments[2] === 'agencies' && segments[3]) {
      setSelection({ countryId: segments[1], agencyId: segments[3], departmentId: null });
      return;
    }

    // /departments/:departmentId/...
    if (segments[0] === 'departments' && segments[1]) {
      const found = findDepartmentContext(segments[1]);
      if (found) setSelection(found);
      else setSelection({ departmentId: segments[1] });
      return;
    }

    // /countries/:countryId/...
    if (segments[0] === 'countries' && segments[1]) {
      setSelection({ countryId: segments[1], agencyId: null, departmentId: null });
      return;
    }

    // /agencies/:agencyId/... (redirigé ensuite vers /countries/.../agencies/...)
    if (segments[0] === 'agencies' && segments[1] && segments[1] !== 'trash') {
      const agency = findAgency(segments[1]);
      if (agency) setSelection({ countryId: agency.country_id, agencyId: agency.id, departmentId: null });
      return;
    }

    // Pages globales (tableau de bord groupe, listes...) : aucune sélection.
    // Sinon les listes restent pré-remplies (1er pays / 1re agence) et choisir
    // cette même valeur ne déclenche rien — le header semblait « cassé ».
    setSelection({ countryId: null, agencyId: null, departmentId: null });
  }, [location.pathname, countries, loading, setSelection, findAgency, findDepartmentContext]);

  const handleCountryChange = useCallback(
    (countryId: string) => {
      setSelection({ countryId: countryId || null });
      // Option vide = retour au niveau PEKEGNO GROUP.
      navigate(countryId ? `/countries/${countryId}` : '/');
    },
    [setSelection, navigate],
  );

  const handleAgencyChange = useCallback(
    (agencyId: string) => {
      if (!agencyId) {
        // Option vide = retour au pays.
        setSelection({ agencyId: null });
        navigate(selection.countryId ? `/countries/${selection.countryId}` : '/');
        return;
      }
      const agency = findAgency(agencyId);
      const countryId = agency?.country_id ?? selection.countryId;
      setSelection({ agencyId, countryId });
      if (agency) {
        navigate(`/countries/${agency.country_id}/agencies/${agencyId}`);
      } else if (countryId) {
        navigate(`/countries/${countryId}/agencies/${agencyId}`);
      } else {
        navigate(`/agencies/${agencyId}`);
      }
    },
    [findAgency, selection.countryId, setSelection, navigate],
  );

  const handleDepartmentChange = useCallback(
    (departmentId: string) => {
      if (!departmentId) {
        // Option vide = retour à l'agence (ou au pays).
        setSelection({ departmentId: null });
        if (selection.countryId && selection.agencyId) navigate(`/countries/${selection.countryId}/agencies/${selection.agencyId}`);
        else if (selection.countryId) navigate(`/countries/${selection.countryId}`);
        return;
      }
      const found = findDepartmentContext(departmentId);
      if (found) setSelection(found);
      else setSelection({ departmentId });
      navigate(`/departments/${departmentId}`);
    },
    [findDepartmentContext, selection.countryId, selection.agencyId, setSelection, navigate],
  );

  const countryGroups: OptionGroup[] = useMemo(
    () => [
      {
        options: countries.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
      },
    ],
    [countries],
  );

  // Une fois un pays sélectionné, on ne propose plus que ses agences (au lieu de
  // la liste complète de tous les pays) : moins de scroll, moins de clics.
  const agencyGroups: OptionGroup[] = useMemo(
    () =>
      countries
        .filter((c) => !selection.countryId || c.id === selection.countryId)
        .map((c) => ({
          label: c.name,
          options: c.agencies.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })),
        })),
    [countries, selection.countryId],
  );

  // Idem pour les départements : filtrés par l'agence sélectionnée, sinon par
  // le pays sélectionné, sinon la liste complète (comportement d'origine).
  const departmentGroups: OptionGroup[] = useMemo(
    () =>
      countries
        .filter((c) => !selection.countryId || c.id === selection.countryId)
        .flatMap((c) =>
          c.agencies
            .filter((a) => (a.departments?.length ?? 0) > 0)
            .filter((a) => !selection.agencyId || a.id === selection.agencyId)
            .map((a) => ({
              label: `${a.name} · ${c.name}`,
              options: a.departments.map((d) => ({ value: d.id, label: d.name })),
            })),
        ),
    [countries, selection.countryId, selection.agencyId],
  );

  if (loading) {
    return (
      <div className="flex h-[70px] items-center justify-center border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  const orgSelectors = (itemClassName: string) => (
    <>
      <SelectDropdown
        className={itemClassName}
        label={t('contextBar.country')}
        icon={Globe}
        value={selection.countryId}
        onChange={handleCountryChange}
        groups={countryGroups}
        placeholder={t('contextBar.selectCountry')}
      />
      <SelectDropdown
        className={itemClassName}
        label={t('contextBar.agency')}
        icon={Building2}
        value={selection.agencyId}
        onChange={handleAgencyChange}
        groups={agencyGroups}
        placeholder={t('contextBar.selectAgency')}
      />
      <SelectDropdown
        className={itemClassName}
        label={t('contextBar.department')}
        icon={FolderTree}
        value={selection.departmentId}
        onChange={handleDepartmentChange}
        groups={departmentGroups}
        placeholder={t('contextBar.selectDepartment')}
      />
    </>
  );

  return (
    <header className="shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-16 items-center gap-2 px-3 sm:px-4 lg:h-[70px]">
        {onMobileMenuToggle && (
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="-ml-1 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            aria-label={t('nav.menu', 'Menu')}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Mobile/tablette : le logo remplace les listes (déplacées sur la 2e ligne). */}
        <span className="min-w-0 shrink lg:hidden">
          <BrandLogo className="h-7" />
        </span>

        {showOrgSelectors && (
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="mr-1 shrink-0">
              <BrandLogo className="h-7" />
            </span>
            <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
            {orgSelectors('max-w-[13rem]')}
          </div>
        )}

        {leftSlot && <div className="shrink-0 sm:ml-2">{leftSlot}</div>}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {rightSlot}
          {(canValidate || isCommercial) && (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() =>
                  setNotifOpen((v) => {
                    const next = !v;
                    if (next && isCommercial && user) {
                      localStorage.setItem(seenValidatedKey(user.id), new Date().toISOString());
                      setValidatedUnseenTotal(0);
                    }
                    return next;
                  })
                }
                className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label={t('contextBar.notifications')}
              >
                <Bell className="h-4.5 w-4.5" />
                {(canValidate ? pendingTotal : validatedUnseenTotal) > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {(canValidate ? pendingTotal : validatedUnseenTotal) > 99
                      ? '99+'
                      : canValidate
                        ? pendingTotal
                        : validatedUnseenTotal}
                  </span>
                )}
              </button>

              {notifOpen && canValidate && (
                <div className="fixed inset-x-3 top-16 z-40 rounded-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 border border-gray-100 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-100">
                    {t('contextBar.pendingValidations')}
                  </div>
                  {pendingInvoices.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">{t('contextBar.noPending')}</p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto">
                      {pendingInvoices.map((inv) => (
                        <li key={inv.id}>
                          <Link
                            to="/invoices/pending"
                            onClick={() => setNotifOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
                          >
                            {Number(inv.payment_proofs_count ?? 0) > 0 ? (
                              <ImageIcon className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                            )}
                            <span className="flex-1 truncate">
                              <span className="font-medium text-gray-800 dark:text-gray-100">{inv.number}</span>
                              <span className="ml-1.5 text-gray-500 dark:text-gray-400">{inv.client_label ?? ''}</span>
                            </span>
                            <span className="shrink-0 font-medium text-gray-700 dark:text-gray-200">
                              {formatCurrency(inv.total_amount)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    to="/invoices/pending"
                    onClick={() => setNotifOpen(false)}
                    className="block border-t border-gray-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                  >
                    {t('contextBar.seeAllPending', { count: pendingTotal })}
                  </Link>
                </div>
              )}

              {notifOpen && !canValidate && isCommercial && (
                <div className="fixed inset-x-3 top-16 z-40 rounded-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 border border-gray-100 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-100">
                    {t('contextBar.validatedInvoices')}
                  </div>
                  {validatedInvoices.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">{t('contextBar.noValidated')}</p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto">
                      {validatedInvoices.map((inv) => (
                        <li key={inv.id}>
                          <Link
                            to={`/invoices/${inv.id}`}
                            onClick={() => setNotifOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-green-500" />
                            <span className="flex-1 truncate">
                              <span className="font-medium text-gray-800 dark:text-gray-100">{inv.number}</span>
                              <span className="ml-1.5 text-gray-500 dark:text-gray-400">{inv.client_label ?? ''}</span>
                            </span>
                            <span className="shrink-0 font-medium text-gray-700 dark:text-gray-200">
                              {formatCurrency(inv.total_amount)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    to="/invoices"
                    onClick={() => setNotifOpen(false)}
                    className="block border-t border-gray-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
                  >
                    {t('contextBar.seeAllInvoices')}
                  </Link>
                </div>
              )}
            </div>
          )}
          <UserMenu />
        </div>
      </div>

      {showOrgSelectors && (
        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 px-3 py-2 sm:px-4 lg:hidden dark:border-gray-800">
          {orgSelectors('w-full')}
        </div>
      )}
    </header>
  );
}