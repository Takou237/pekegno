import type { ReactNode } from 'react';

type Variant = 'error' | 'success' | 'info';

const variantClasses: Record<Variant, string> = {
  error: 'border-error-500/30 bg-error-500/10 text-error-500',
  success: 'border-success-500/30 bg-success-500/10 text-success-500',
  info: 'border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-300',
};

export function Alert({
  variant = 'info',
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 text-sm ${variantClasses[variant]}`}
    >
      {children}
    </div>
  );
}
