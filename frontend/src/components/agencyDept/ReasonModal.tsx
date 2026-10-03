import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/** Demande un motif (obligatoire) avant une transition de statut. */
export function ReasonModal({
  isOpen,
  title,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('agencyDept.reason')} *
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-gray-700 dark:text-white"
          />
        </label>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => onConfirm(reason.trim())} disabled={!reason.trim()} isLoading={isLoading}>
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
