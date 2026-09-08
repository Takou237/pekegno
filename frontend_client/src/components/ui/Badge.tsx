import { classNames } from '@/utils';

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'neutral' | 'brand';
  children: React.ReactNode;
}

const variants = {
  success: 'bg-success-50 text-success-700 ring-success-600/20',
  error: 'bg-error-50 text-error-700 ring-error-600/20',
  warning: 'bg-warning-50 text-warning-700 ring-warning-600/20',
  neutral: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span className={classNames('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', variants[variant])}>
      {children}
    </span>
  );
}

export function ValidationBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
    validated: 'success',
    rejected: 'error',
    pending: 'warning',
  };
  const labels: Record<string, string> = {
    validated: 'Validée',
    rejected: 'Rejetée',
    pending: 'En attente',
  };
  return <Badge variant={map[status] ?? 'neutral'}>{labels[status] ?? status}</Badge>;
}
