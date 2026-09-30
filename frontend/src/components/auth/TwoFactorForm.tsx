import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function TwoFactorForm() {
  const { t } = useTranslation();
  const { verifyTwoFactor, pendingTwoFactorToken, pendingTwoFactorChannel } =
    useAuth();

  const isEmailChannel = pendingTwoFactorChannel === 'email';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const code = digits.join('');

  // Le code email vient d'être envoyé au moment du login : le cooldown démarre
  // à l'affichage du formulaire. Pour le TOTP il n'y a rien à renvoyer.
  useEffect(() => {
    if (!isEmailChannel) {
      return;
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    const timer = setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isEmailChannel, pendingTwoFactorToken]);

  function handleDigitChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (value && index < CODE_LENGTH - 1) {
      document.getElementById(`two-factor-digit-${index + 1}`)?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      document.getElementById(`two-factor-digit-${index - 1}`)?.focus();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (code.length !== CODE_LENGTH) {
      setFormError(t('auth.twoFactorError'));
      return;
    }

    setIsSubmitting(true);
    try {
      // La redirection vers "/" est gérée par GuestRoute (<Navigate>) dès que
      // la session est posée. Éviter la double navigation impérative ici
      // empêche l'erreur React "insertBefore ... not a child of this node".
      await verifyTwoFactor(code);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('auth.twoFactorInvalid')));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!pendingTwoFactorToken || resendCooldown > 0) {
      return;
    }

    setFormError(null);
    setInfoMessage(null);

    try {
      await authApi.resendTwoFactorEmailCode(pendingTwoFactorToken);
      setInfoMessage(t('auth.twoFactorEmailResent'));
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('auth.twoFactorEmailResendFailed')));
    }
  }

  if (!pendingTwoFactorToken) {
    return (
      <Alert variant="info">{t('auth.twoFactorNone')}</Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}
      {infoMessage && <Alert variant="success">{infoMessage}</Alert>}

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {isEmailChannel
          ? t('auth.twoFactorEmailSent')
          : t('auth.twoFactorTotpHint')}
      </p>

      <div className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            id={`two-factor-digit-${index}`}
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="h-14 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        ))}
      </div>

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        {t('auth.twoFactorVerify')}
      </Button>

      {isEmailChannel && (
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-center text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-brand-400"
        >
          {resendCooldown > 0
            ? t('auth.twoFactorEmailResendIn', { seconds: resendCooldown })
            : t('auth.twoFactorEmailResend')}
        </button>
      )}
    </form>
  );
}
