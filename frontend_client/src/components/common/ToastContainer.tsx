import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { Toast } from '@/context/ToastContext';
import { useToast } from '@/context/ToastContext';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-success-50 border-success-200 text-success-700',
  error: 'bg-error-50 border-error-200 text-error-700',
  info: 'bg-brand-50 border-brand-200 text-brand-700',
  warning: 'bg-warning-50 border-warning-200 text-warning-700',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useToast();
  const Icon = icons[toast.variant];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-toast-in ${colors[toast.variant]}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button onClick={() => dismissToast(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  const [visible, setVisible] = useState<Toast[]>([]);

  useEffect(() => {
    setVisible(toasts);
  }, [toasts]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[600] flex flex-col gap-2 max-w-sm">
      {visible.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
