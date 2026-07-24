import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import type { ToastVariant } from '@/context/ToastContext';

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-success-200 bg-success-50 text-success-700',
  error: 'border-error-200 bg-error-50 text-error-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-700',
  info: 'border-brand-200 bg-brand-50 text-brand-700',
};

const VARIANT_ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[999] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = VARIANT_ICONS[toast.variant];
        return (
          <div
            key={toast.id}
            role="alert"
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${VARIANT_STYLES[toast.variant]}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
