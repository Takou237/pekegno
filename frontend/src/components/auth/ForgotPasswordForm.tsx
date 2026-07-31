import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await authApi.forgotPassword({ email });
      // Le backend renvoie toujours 200 (message générique), qu'un compte
      // existe ou non, pour éviter l'énumération d'emails.
      setIsSubmitted(true);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('auth.forgotFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success">{t('auth.forgotSuccess')}</Alert>
        <Link to="/login" className="text-center text-sm font-medium text-brand-600 hover:underline">
          {t('common.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input
        label={t('auth.email')}
        type="email"
        name="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder={t('auth.emailPlaceholder')}
      />

      <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
        {t('auth.sendResetLink')}
      </Button>

      <Link to="/login" className="text-center text-sm font-medium text-brand-600 hover:underline">
        {t('common.backToLogin')}
      </Link>
    </form>
  );
}
