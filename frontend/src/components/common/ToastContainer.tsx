import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import type { ToastVariant } from '@/context/ToastContext';

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-l-success-500 bg-white text-gray-800',
  error: 'border-l-error-500 bg-white text-gray-800',
  warning: 'border-l-warning-500 bg-white text-gray-800',
  info: 'border-l-brand-500 bg-white text-gray-800',
};

const VARIANT_ICON_STYLES: Record<ToastVariant, string> = {
  success: 'bg-success-100 text-success-700',
  error: 'bg-error-100 text-error-700',
  warning: 'bg-warning-100 text-warning-700',
  info: 'bg-brand-100 text-brand-700',
};

const VARIANT_ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  const { t } = useTranslation();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-md flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = VARIANT_ICONS[toast.variant];
        return (
          <div
            key={toast.id}
            role="alert"
            className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-gray-100 border-l-4 py-3.5 pl-4 pr-3 shadow-2xl ${VARIANT_STYLES[toast.variant]}`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${VARIANT_ICON_STYLES[toast.variant]}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <p className="flex-1 pt-1 text-sm font-semibold leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
