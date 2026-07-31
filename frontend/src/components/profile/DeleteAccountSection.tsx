import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await authApi.deleteAccount({ password });
      showToast(t('profile.deleteAccountSuccess'), 'success');
      // Le compte + tokens sont déjà révoqués côté serveur ; on nettoie la
      // session locale sans rappeler /auth/logout (le token n'existe plus).
      await logout().catch(() => undefined);
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, t('profile.deleteAccountFailed')));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-error-200 bg-error-50/40 p-4 dark:border-error-500/30 dark:bg-error-500/5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-error-700 dark:text-error-400">
            {t('profile.dangerZone')}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {t('profile.deleteAccountDesc')}
          </p>
        </div>
        <div className="w-48 shrink-0">
          <Button
            variant="outline"
            className="!border-error-300 !text-error-600 hover:!bg-error-50"
            onClick={() => setIsModalOpen(true)}
          >
            {t('profile.deleteAccountTitle')}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('profile.deleteAccountModalTitle')}
      >
        <form onSubmit={handleDelete} className="flex flex-col gap-4">
          <Alert variant="error">{t('profile.deleteAccountWarning')}</Alert>
          {formError && <Alert variant="error">{formError}</Alert>}
          <Input
            label={t('auth.password')}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={!password || isSubmitting}
            className="!bg-error-500 hover:!bg-error-600"
          >
            {t('profile.deleteAccountConfirm')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
