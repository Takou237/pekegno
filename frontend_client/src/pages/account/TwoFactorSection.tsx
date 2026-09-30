import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Section « Sécurité » du profil client : activation / désactivation de la
 * double authentification par email (code à 6 chiffres à chaque connexion).
 */
export function TwoFactorSection() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const enabled = Boolean(user?.two_factor_enabled);

  // Flux d'activation : le premier code a été envoyé, il faut le confirmer.
  const [isActivating, setIsActivating] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [activationError, setActivationError] = useState('');
  const [activating, setActivating] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [starting, setStarting] = useState(false);

  // Flux de désactivation : mot de passe + code.
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [sendingDisableCode, setSendingDisableCode] = useState(false);

  useEffect(() => {
    if (!isActivating) {
      return;
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    const timer = setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActivating]);

  const setDigit = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < 5) {
      document.getElementById(`client-2fa-setup-${index + 1}`)?.focus();
    }
  };

  const handleStartActivation = async () => {
    setActivationError('');
    setStarting(true);
    try {
      await authApi.enableTwoFactor();
      setIsActivating(true);
      setDigits(Array(6).fill(''));
      showToast(t('account.twoFactorCodeSent'), 'info');
    } catch (err) {
      showToast(extractErrorMessage(err, t('account.twoFactorStartError')), 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleResendActivationCode = async () => {
    if (resendCooldown > 0) {
      return;
    }
    try {
      await authApi.sendTwoFactorEmailCode();
      showToast(t('account.twoFactorCodeResent'), 'success');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setActivationError(extractErrorMessage(err, t('account.twoFactorResendError')));
    }
  };

  const handleConfirmActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');

    if (code.length !== 6) {
      setActivationError(t('account.twoFactorEnterCode'));
      return;
    }

    setActivationError('');
    setActivating(true);
    try {
      await authApi.verifyTwoFactor(code);
      await refreshUser();
      setIsActivating(false);
      setDigits(Array(6).fill(''));
      showToast(t('account.twoFactorEnabled'), 'success');
    } catch (err) {
      setActivationError(extractErrorMessage(err, t('account.twoFactorInvalidCode')));
    } finally {
      setActivating(false);
    }
  };

  const handleCancelActivation = () => {
    setIsActivating(false);
    setDigits(Array(6).fill(''));
    setActivationError('');
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError('');
    setDisabling(true);
    try {
      await authApi.disableTwoFactor(disablePassword, disableCode);
      await refreshUser();
      setShowDisable(false);
      setDisablePassword('');
      setDisableCode('');
      showToast(t('account.twoFactorDisabled'), 'success');
    } catch (err) {
      setDisableError(extractErrorMessage(err, t('account.twoFactorDisableError')));
    } finally {
      setDisabling(false);
    }
  };

  const handleSendDisableCode = async () => {
    setDisableError('');
    setSendingDisableCode(true);
    try {
      await authApi.sendTwoFactorEmailCode();
      showToast(t('account.twoFactorCodeSent'), 'info');
    } catch (err) {
      setDisableError(extractErrorMessage(err, t('account.twoFactorResendError')));
    } finally {
      setSendingDisableCode(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        {enabled ? (
          <ShieldCheck size={18} className="text-success-600" />
        ) : (
          <ShieldAlert size={18} className="text-warning-500" />
        )}
        {t('account.twoFactorTitle')}
      </h2>
      <p className="text-sm text-gray-500 mt-1 max-w-lg">{t('account.twoFactorDesc')}</p>

      {activationError && (
        <div className="mt-4 max-w-lg">
          <Alert variant="error">{activationError}</Alert>
        </div>
      )}

      {!enabled && !isActivating && (
        <div className="mt-4 max-w-lg flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">{t('account.twoFactorOff')}</p>
          <Button onClick={handleStartActivation} isLoading={starting} className="shrink-0">
            <Shield size={16} className="mr-1.5 inline" />
            {t('account.twoFactorEnableAction')}
          </Button>
        </div>
      )}

      {isActivating && (
        <form onSubmit={handleConfirmActivation} className="mt-4 max-w-lg space-y-4">
          <p className="text-sm text-gray-600">{t('account.twoFactorEnterSentCode')}</p>
          <div className="flex justify-between gap-2">
            {digits.map((digit, index) => (
              <input
                key={index}
                id={`client-2fa-setup-${index}`}
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => setDigit(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[index] && index > 0) {
                    document.getElementById(`client-2fa-setup-${index - 1}`)?.focus();
                  }
                }}
                className="h-14 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" isLoading={activating}>{t('account.twoFactorConfirm')}</Button>
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={handleResendActivationCode}
                disabled={resendCooldown > 0}
                className="font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400"
              >
                {resendCooldown > 0
                  ? t('account.twoFactorResendIn', { seconds: resendCooldown })
                  : t('account.twoFactorResend')}
              </button>
              <button
                type="button"
                onClick={handleCancelActivation}
                className="text-gray-500 hover:text-gray-700"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </form>
      )}

      {enabled && !showDisable && (
        <div className="mt-4 max-w-lg flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            {t('account.twoFactorOn')}{' '}
            <span className="text-success-600 font-medium">({user?.email})</span>
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setShowDisable(true);
              // Les clients sont toujours en canal email : le code part dès l'ouverture.
              void handleSendDisableCode();
            }}
            className="shrink-0"
          >
            {t('account.twoFactorDisableAction')}
          </Button>
        </div>
      )}

      {enabled && showDisable && (
        <form onSubmit={handleDisable} className="mt-4 max-w-lg space-y-4">
          {disableError && <Alert variant="error">{disableError}</Alert>}
          <Input
            label={t('account.currentPassword')}
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            label={t('account.twoFactorCodeLabel')}
            inputMode="numeric"
            maxLength={6}
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
            required
            placeholder="123456"
          />
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" isLoading={disabling} className="!bg-error-500 hover:!bg-error-600">
              {t('account.twoFactorConfirmDisable')}
            </Button>
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={handleSendDisableCode}
                disabled={sendingDisableCode}
                className="font-medium text-brand-600 hover:text-brand-700 disabled:text-gray-400"
              >
                {t('account.twoFactorResend')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisable(false);
                  setDisableError('');
                  setDisablePassword('');
                  setDisableCode('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
