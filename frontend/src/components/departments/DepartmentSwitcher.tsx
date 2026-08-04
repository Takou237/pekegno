import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, ChevronUp, MapPin, ShieldCheck } from 'lucide-react';
import { departmentsApi } from '@/api/departments.api';
import { useAuth } from '@/hooks/useAuth';
import type { Department } from '@/types/department';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];

interface DepartmentSwitcherProps {
  department: Department;
}

export function DepartmentSwitcher({ department }: DepartmentSwitcherProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    departmentsApi
      .list({ per_page: 100 })
      .then((r) => {
        if (active) setDepartments(r.data);
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
    if (ADMIN_ROLES.includes(user?.role?.name ?? '')) return departments;
    const assignedDeptIds = new Set(
      (user?.assignments ?? [])
        .filter((a) => a.pivot?.is_department_chief === true && a.pivot?.department_id)
        .map((a) => a.pivot?.department_id as string)
    );
    const assignedAgencyIds = new Set((user?.assignments ?? []).map((a) => a.id));
    return departments.filter(
      (d) => assignedDeptIds.has(d.id) || assignedAgencyIds.has(d.agency_id)
    );
  }, [departments, user]);

  const otherDepartments = options.filter((d) => d.id !== department.id);

  function handleSelect(id: string) {
    setIsOpen(false);
    if (id !== department.id) navigate(`/departments/${id}`);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => otherDepartments.length > 0 && setIsOpen((prev) => !prev)}
        disabled={otherDepartments.length === 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full text-left ${otherDepartments.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            {department.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                {department.name}
              </h1>
              {otherDepartments.length > 0 && (
                <span className="shrink-0 text-gray-400">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{t('departments.title')}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{department.agency?.name ?? '—'}</span>
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{t('departments.colChief')}: {department.department_chief?.name ?? '—'}</span>
          </span>
          {department.agency && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">
                {department.agency.country}
                {department.agency.city ? `, ${department.agency.city}` : ''}
              </span>
            </span>
          )}
        </div>
      </button>

      {isOpen && otherDepartments.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
            {t('departments.switchTo')}
          </p>
          {otherDepartments.map((d) => (
            <button
              key={d.id}
              type="button"
              role="option"
              onClick={() => handleSelect(d.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                {d.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.name}</span>
                <span className="block truncate text-xs text-gray-400">{d.agency?.name ?? '—'}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
