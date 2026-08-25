import { type ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe, Building2, FolderTree, Bell, Menu } from 'lucide-react';
import { useOrgContext } from '@/context/OrgContext';
import { UserMenu } from '@/components/common/UserMenu';
import { Spinner } from '@/components/ui/Spinner';

function SelectDropdown({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  icon: typeof Globe;
  value: string | null;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <label className="sr-only">{label}</label>
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
        <Icon className="h-4 w-4" />
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-7 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500/50"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
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
  const {
    countries,
    selectedCountry,
    selection,
    loading,
    setSelection,
  } = useOrgContext();

  const handleCountryChange = useCallback(
    (countryId: string) => {
      setSelection({ countryId: countryId || null });
      if (countryId) {
        navigate(`/countries/${countryId}`);
      }
    },
    [setSelection, navigate],
  );

  const handleAgencyChange = useCallback(
    (agencyId: string) => {
      setSelection({ agencyId: agencyId || null });
      if (agencyId && selection.countryId) {
        navigate(`/countries/${selection.countryId}/agencies/${agencyId}`);
      }
    },
    [setSelection, navigate, selection.countryId],
  );

  const handleDepartmentChange = useCallback(
    (departmentId: string) => {
      setSelection({ departmentId: departmentId || null });
      if (departmentId) {
        navigate(`/departments/${departmentId}`);
      }
    },
    [setSelection, navigate],
  );

  const countryOptions = countries.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
  const agencyOptions = (selectedCountry?.agencies ?? []).map((a) => ({
    value: a.id,
    label: `${a.name} (${a.code})`,
  }));
  const selectedAgency = selection.agencyId
    ? (selectedCountry?.agencies ?? []).find((a) => a.id === selection.agencyId) ?? null
    : null;
  const departmentOptions = (selectedAgency?.departments ?? []).map((d: { id: string; name: string }) => ({
    value: d.id,
    label: d.name,
  }));

  if (loading) {
    return (
      <div className="flex h-[70px] items-center justify-center border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-[70px] shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 dark:border-gray-800 dark:bg-gray-900 sm:px-4">
      {onMobileMenuToggle && (
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="mr-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          aria-label={t('nav.menu', 'Menu')}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <span className="mr-1 hidden text-sm font-bold tracking-tight text-brand-600 dark:text-brand-400 lg:block">
        PEKEGNO
      </span>
      <span className="mx-1 hidden text-gray-300 dark:text-gray-600 lg:inline">|</span>

      <SelectDropdown
        label={t('contextBar.country')}
        icon={Globe}
        value={selection.countryId}
        onChange={handleCountryChange}
        options={countryOptions}
        placeholder={t('contextBar.selectCountry')}
      />

      <SelectDropdown
        label={t('contextBar.agency')}
        icon={Building2}
        value={selection.agencyId}
        onChange={handleAgencyChange}
        options={agencyOptions}
        placeholder={t('contextBar.selectAgency')}
      />

      <SelectDropdown
        label={t('contextBar.department')}
        icon={FolderTree}
        value={selection.departmentId}
        onChange={handleDepartmentChange}
        options={departmentOptions}
        placeholder={t('contextBar.selectDepartment')}
      />

      {leftSlot && <div className="ml-2 hidden lg:block">{leftSlot}</div>}

      <div className="ml-auto flex items-center gap-1">
        {rightSlot}
        <button
          type="button"
          className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label={t('contextBar.notifications')}
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
        <UserMenu />
      </div>
    </div>
  );
}
