import { useState, type FormEvent } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isEnabling, setIsEnabling] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  async function handleStartSetup() {
    setSetupError(null);
    setIsEnabling(true);
    try {
      const data = await authApi.enableTwoFactor();
      setSecret(data.secret);
      const dataUrl = await QRCode.toDataURL(data.qr_code_url, {
        width: 160,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      setSetupError(extractErrorMessage(error, t('profile.twoFactorActivationFailed')));
    } finally {
      setIsEnabling(false);
    }
  }

  async function handleVerifySetup(event: FormEvent) {
    event.preventDefault();
    setSetupError(null);
    setIsVerifying(true);
    try {
      await authApi.verifyTwoFactorSetup(verifyCode);
      showToast(t('profile.twoFactorActivated'), 'success');
      setSecret('');
      setQrDataUrl('');
      setVerifyCode('');
      await refreshUser();
    } catch (error) {
      setSetupError(extractErrorMessage(error, t('profile.twoFactorInvalidCode')));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    setDisableError(null);
    setIsDisabling(true);
    try {
      await authApi.disableTwoFactor(disablePassword, disableCode);
      showToast(t('profile.twoFactorDeactivated'), 'success');
      setIsDisableModalOpen(false);
      setDisablePassword('');
      setDisableCode('');
      await refreshUser();
    } catch (error) {
      setDisableError(extractErrorMessage(error, t('profile.twoFactorDisableFailed')));
    } finally {
      setIsDisabling(false);
    }
  }

  const showSetup = Boolean(secret && qrDataUrl);

  return (
    <div id="security" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
        {user.two_factor_enabled ? (
          <ShieldCheck className="h-8 w-8 text-success-500" />
        ) : (
          <ShieldAlert className="h-8 w-8 text-warning-500" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {t('profile.twoFactorStatus')}{' '}
            {user.two_factor_enabled ? (
              <span className="text-success-600">{t('profile.twoFactorEnabled')}</span>
            ) : (
              <span className="text-warning-600">{t('profile.twoFactorNotEnabled')}</span>
            )}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('profile.twoFactorDesc')}
          </p>
        </div>
        <div className="w-48 shrink-0">
          {user.two_factor_enabled ? (
            <Button variant="outline" onClick={() => setIsDisableModalOpen(true)} fullWidth>
              {t('profile.twoFactorDisable')}
            </Button>
          ) : (
            <Button onClick={handleStartSetup} isLoading={isEnabling} fullWidth>
              {t('profile.twoFactorEnable')}
            </Button>
          )}
        </div>
      </div>

      {showSetup && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
          {setupError && <Alert variant="error">{setupError}</Alert>}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('profile.twoFactorScan')}
          </p>
          <img
            src={qrDataUrl}
            alt={t('profile.twoFactorQrAlt')}
            className="h-40 w-40 rounded-lg border border-gray-100 dark:border-gray-800"
          />
          <p className="break-all rounded bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {secret}
          </p>
          <form onSubmit={handleVerifySetup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label={t('profile.twoFactorVerificationCode')}
                inputMode="numeric"
                maxLength={6}
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
              />
            </div>
            <div className="w-full sm:w-48">
              <Button type="submit" isLoading={isVerifying} fullWidth>
                {t('profile.twoFactorConfirmActivation')}
              </Button>
            </div>
          </form>
        </div>
      )}

      <Modal
        isOpen={isDisableModalOpen}
        onClose={() => setIsDisableModalOpen(false)}
        title={t('profile.twoFactorDisableTitle')}
      >
        <form onSubmit={handleDisable} className="flex flex-col gap-4">
          {disableError && <Alert variant="error">{disableError}</Alert>}
          <Input
            label={t('auth.currentPassword')}
            type="password"
            required
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
          />
          <Input
            label={t('profile.twoFactorCurrentCode')}
            inputMode="numeric"
            maxLength={6}
            required
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
          <Button type="submit" isLoading={isDisabling} fullWidth className="!bg-error-500 hover:!bg-error-600">
            {t('profile.twoFactorDisableButton')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
