import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { classNames } from '@/utils';

interface AlertProps {
  variant?: 'error' | 'success' | 'info';
  children: React.ReactNode;
}

const config = {
  error: { icon: AlertCircle, wrapper: 'border-error-200 bg-error-50 text-error-700' },
  success: { icon: CheckCircle, wrapper: 'border-success-200 bg-success-50 text-success-700' },
  info: { icon: Info, wrapper: 'border-brand-200 bg-brand-50 text-brand-700' },
};

export function Alert({ variant = 'info', children }: AlertProps) {
  const { icon: Icon, wrapper } = config[variant];
  return (
    <div className={classNames('flex items-start gap-3 rounded-lg border p-4 text-sm', wrapper)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
