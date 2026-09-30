import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const { t } = useTranslation();
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 w-full ${maxWidth} max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6 dark:bg-gray-900`}
      >
        <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
          <h2 id="modal-title" className="min-w-0 text-base font-semibold sm:text-lg text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
