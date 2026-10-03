import type { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Department, DepartmentType } from '@/types/department';

/**
 * Plusieurs types de département partagent un même chemin (`reports`,
 * `invoices`, `receivables`…). Ce composant choisit la page selon le type du
 * département courant (fourni par DepartmentLayout), avec un repli `fallback`.
 */
export function ByDepartmentType({
  pages,
  fallback = null,
}: {
  pages: Partial<Record<DepartmentType, ReactNode>>;
  fallback?: ReactNode;
}) {
  const ctx = useOutletContext<{ department: Department | null } | undefined>();
  const type = ctx?.department?.type;

  return <>{(type && pages[type]) ?? fallback}</>;
}
