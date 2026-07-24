import type { ReactNode } from 'react';

type Variant = 'success' | 'error' | 'warning' | 'neutral' | 'brand';

const VARIANT_CLASSES: Record<Variant, string> = {
  success: 'bg-success-50 text-success-700',
  error: 'bg-error-50 text-error-700',
  warning: 'bg-warning-50 text-warning-700',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  brand: 'bg-brand-50 text-brand-700',
};

export function Badge({
  variant = 'neutral',
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
