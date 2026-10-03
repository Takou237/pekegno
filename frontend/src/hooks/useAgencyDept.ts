import { useOutletContext } from 'react-router-dom';
import type { Department } from '@/types/department';

export interface DepartmentOutletContext {
  department: Department | null;
  departmentId?: string;
  agencyId?: string;
  refreshDepartment?: () => void;
}

/** Contexte fourni par DepartmentLayout aux pages d'un département. */
export function useAgencyDept() {
  const ctx = useOutletContext<DepartmentOutletContext>();
  const departmentId = ctx?.departmentId ?? ctx?.department?.id;
  return {
    department: ctx?.department ?? null,
    departmentId,
    agencyId: ctx?.agencyId ?? ctx?.department?.agency_id,
    basePath: departmentId ? `/departments/${departmentId}` : '',
  };
}
