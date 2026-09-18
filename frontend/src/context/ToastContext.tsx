import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 5000;

// crypto.randomUUID() n'existe que dans un contexte sécurisé (HTTPS/localhost) :
// en http:// (ex. déploiement sans SSL), il est absent et plante tout appel à
// showToast(), ce qui casse silencieusement les flux succès (création,
// suppression, auth...) en empêchant le code après le toast de s'exécuter.
function generateToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = generateToastId();
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
