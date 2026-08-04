import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const CODE_LENGTH = 6;

export function TwoFactorForm() {
  const { t } = useTranslation();
  const { verifyTwoFactor, pendingTwoFactorToken } = useAuth();
  const navigate = useNavigate();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const code = digits.join('');

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
      await verifyTwoFactor(code);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, t('auth.twoFactorInvalid')));
    } finally {
      setIsSubmitting(false);
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
    </form>
  );
}
