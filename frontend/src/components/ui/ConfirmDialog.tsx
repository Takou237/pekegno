import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="max-w-md">
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">{message}</p>
      <div className="flex justify-end gap-3">
        <div className="w-32">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel || t('common.cancel')}
          </Button>
        </div>
        <div className="w-32">
          <Button
            onClick={onConfirm}
            isLoading={isLoading}
            className={variant === 'danger' ? '!bg-error-500 hover:!bg-error-600' : ''}
          >
            {confirmLabel || t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
