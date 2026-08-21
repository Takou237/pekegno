import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Mail, MapPin, Phone } from 'lucide-react';
import { agenciesApi } from '@/api/agencies.api';
import { useAuth } from '@/hooks/useAuth';
import type { Agency } from '@/types/agency';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];

interface AgencySwitcherProps {
  agency: Agency;
}

export function AgencySwitcher({ agency }: AgencySwitcherProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { countryId } = useParams<{ countryId?: string }>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    agenciesApi
      .list({ per_page: 100 })
      .then((r) => {
        if (active) setAgencies(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = useMemo(() => {
    if (ADMIN_ROLES.includes(user?.role?.name ?? '')) return agencies;
    const assignedIds = new Set((user?.assignments ?? []).map((a) => a.id));
    return agencies.filter((a) => assignedIds.has(a.id));
  }, [agencies, user]);

  const otherAgencies = options.filter((a) => a.id !== agency.id);

  function handleSelect(id: string) {
    setIsOpen(false);
    if (id === agency.id) return;
    const target = options.find((a) => a.id === id);
    const targetCountry = countryId ?? target?.country_id ?? agency.country_id;
    navigate(targetCountry ? `/countries/${targetCountry}/agencies/${id}` : `/agencies/${id}`);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => otherAgencies.length > 0 && setIsOpen((prev) => !prev)}
        disabled={otherAgencies.length === 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full text-left ${otherAgencies.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            {agency.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                {agency.name}
              </h1>
              {otherAgencies.length > 0 && (
                <span className="shrink-0 text-gray-400">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-gray-400">{agency.code}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
            {agency.country}
            {agency.city ? `, ${agency.city}` : ''}
          </span>
          {agency.phone && (
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-gray-400" />
              {agency.phone}
            </span>
          )}
          {agency.email && (
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">{agency.email}</span>
            </span>
          )}
        </div>
      </button>

      {isOpen && otherAgencies.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
            {t('agencies.switchTo')}
          </p>
          {otherAgencies.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              onClick={() => handleSelect(a.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                {a.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block truncate text-xs text-gray-400">{a.code}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
