import { useState, type FormEvent } from 'react';
import { Mail, ShieldCheck, ShieldAlert, Smartphone } from 'lucide-react';
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

const RESEND_COOLDOWN_SECONDS = 60;

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  // null = aucun flux d'activation en cours
  const [setupChannel, setSetupChannel] = useState<'totp' | 'email' | null>(null);
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupInfo, setSetupInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isSendingDisableCode, setIsSendingDisableCode] = useState(false);

  if (!user) {
    return null;
  }

  const isEmailChannel = user.two_factor_channel === 'email';

  async function handleStartSetup(channel: 'totp' | 'email') {
    setSetupError(null);
    setSetupInfo(null);
    setIsStarting(true);
    try {
      const data = await authApi.enableTwoFactor(channel);
      setSetupChannel(channel);
      setVerifyCode('');
      setResendCooldown(channel === 'email' ? RESEND_COOLDOWN_SECONDS : 0);

      if (data.channel === 'totp') {
        setSecret(data.secret);
        setMaskedEmail('');
        const dataUrl = await QRCode.toDataURL(data.qr_code_url, {
          width: 160,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(dataUrl);
      } else {
        setSecret('');
        setQrDataUrl('');
        setMaskedEmail(data.masked_email);
      }
    } catch (error) {
      setSetupError(extractErrorMessage(error, t('profile.twoFactorActivationFailed')));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleResendSetupCode() {
    if (resendCooldown > 0) {
      return;
    }

    setSetupError(null);
    setSetupInfo(null);
    try {
      const response = await authApi.sendTwoFactorEmailCode();
      setSetupInfo(response.message);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setSetupError(extractErrorMessage(error, t('profile.twoFactorEmailResendFailed')));
    }
  }

  async function handleVerifySetup(event: FormEvent) {
    event.preventDefault();
    setSetupError(null);
    setIsVerifying(true);
    try {
      await authApi.verifyTwoFactorSetup(verifyCode);
      showToast(t('profile.twoFactorActivated'), 'success');
      setSetupChannel(null);
      setSecret('');
      setQrDataUrl('');
      setMaskedEmail('');
      setVerifyCode('');
      await refreshUser();
    } catch (error) {
      setSetupError(extractErrorMessage(error, t('profile.twoFactorInvalidCode')));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSendDisableCode() {
    setDisableError(null);
    setIsSendingDisableCode(true);
    try {
      await authApi.sendTwoFactorEmailCode();
      showToast(t('profile.twoFactorEmailCodeSentShort'), 'success');
    } catch (error) {
      setDisableError(extractErrorMessage(error, t('profile.twoFactorEmailResendFailed')));
    } finally {
      setIsSendingDisableCode(false);
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

  function handleCancelSetup() {
    setSetupChannel(null);
    setSecret('');
    setQrDataUrl('');
    setMaskedEmail('');
    setVerifyCode('');
    setSetupError(null);
    setSetupInfo(null);
  }

  const showTotpSetup = setupChannel === 'totp' && Boolean(secret && qrDataUrl);
  const showEmailSetup = setupChannel === 'email';

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
            {user.two_factor_enabled && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {isEmailChannel ? (
                  <>
                    <Mail className="h-3 w-3" /> {t('profile.twoFactorChannelEmail')}
                  </>
                ) : (
                  <>
                    <Smartphone className="h-3 w-3" /> {t('profile.twoFactorChannelTotp')}
                  </>
                )}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isEmailChannel
              ? t('profile.twoFactorDescEmail')
              : t('profile.twoFactorDesc')}
          </p>
        </div>
        <div className="w-48 shrink-0">
          {user.two_factor_enabled ? (
            <Button variant="outline" onClick={() => setIsDisableModalOpen(true)} fullWidth>
              {t('profile.twoFactorDisable')}
            </Button>
          ) : null}
        </div>
      </div>

      {!user.two_factor_enabled && !setupChannel && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800 sm:flex-row">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              <Smartphone className="mr-1.5 inline h-4 w-4" />
              {t('profile.twoFactorChooseTotp')}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('profile.twoFactorChooseTotpDesc')}
            </p>
            <Button className="mt-3" onClick={() => handleStartSetup('totp')} isLoading={isStarting}>
              {t('profile.twoFactorChooseTotpAction')}
            </Button>
          </div>
          <div className="flex-1 border-t border-gray-100 pt-3 dark:border-gray-800 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              <Mail className="mr-1.5 inline h-4 w-4" />
              {t('profile.twoFactorChooseEmail')}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('profile.twoFactorChooseEmailDesc')}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => handleStartSetup('email')}
              isLoading={isStarting}
            >
              {t('profile.twoFactorChooseEmailAction')}
            </Button>
          </div>
        </div>
      )}

      {showTotpSetup && (
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
          <button
            type="button"
            onClick={handleCancelSetup}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {showEmailSetup && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
          {setupError && <Alert variant="error">{setupError}</Alert>}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('profile.twoFactorEmailCodeSent', { email: maskedEmail })}
          </p>
          {setupInfo && <Alert variant="info">{setupInfo}</Alert>}
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
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResendSetupCode}
              disabled={resendCooldown > 0}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-brand-400"
            >
              {resendCooldown > 0
                ? t('auth.twoFactorEmailResendIn', { seconds: resendCooldown })
                : t('auth.twoFactorEmailResend')}
            </button>
            <button
              type="button"
              onClick={handleCancelSetup}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              {t('common.cancel')}
            </button>
          </div>
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
          {isEmailChannel && (
            <button
              type="button"
              onClick={handleSendDisableCode}
              disabled={isSendingDisableCode}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-gray-400 dark:text-brand-400"
            >
              {t('profile.twoFactorSendCodeForDisable')}
            </button>
          )}
          <Button type="submit" isLoading={isDisabling} fullWidth className="!bg-error-500 hover:!bg-error-600">
            {t('profile.twoFactorDisableButton')}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
